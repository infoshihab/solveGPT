import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { costEstimatePer1M } from "@solvegpt/model-catalog";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";

export type IncomingAttachment = { name: string; mime: string; dataUrl: string };

export type ChatMsg = {
  role: "user" | "assistant" | "system";
  content: string | ChatCompletionContentPart[];
};

export type StreamChunk =
  | { type: "text"; text: string }
  | { type: "usage"; inputTokens: number; outputTokens: number };

export function estimateCostUsd(model: string, input: number, output: number): number {
  const p = costEstimatePer1M(model);
  return (input * p.in + output * p.out) / 1_000_000;
}

export function flattenMsgContent(content: string | ChatCompletionContentPart[]): string {
  if (typeof content === "string") return content;
  const bits: string[] = [];
  for (const p of content) {
    if (p.type === "text") bits.push(p.text);
    if (p.type === "image_url" && p.image_url?.url) bits.push(`![image](${p.image_url.url})`);
  }
  return bits.join("\n\n");
}

export function mergeUserContentForDb(text: string, files?: IncomingAttachment[]): string {
  if (!files?.length) return text;
  const esc = (n: string) => n.replace(/]/g, "");
  const imgs = files.map((f) => `![${esc(f.name)}](${f.dataUrl})`).join("\n\n");
  const t = text.trim();
  return t ? `${t}\n\n${imgs}` : imgs;
}

// ── Vision helpers ─────────────────────────────────────────────────────────────

function grokSupportsVision(model: string): boolean {
  const m = model.toLowerCase();
  return m.startsWith("grok-3") || m.startsWith("grok-4");
}

/** OpenAI Chat Completions image_url format — used only for Grok (OpenAI-compatible). */
function openAiImageParts(text: string, files: IncomingAttachment[]): ChatCompletionContentPart[] {
  const parts: ChatCompletionContentPart[] = [
    { type: "text", text: text.trim() || "Please describe these images." },
  ];
  for (const f of files) {
    parts.push({ type: "image_url", image_url: { url: f.dataUrl } });
  }
  return parts;
}

/** Extract base64 data and MIME type from a dataUrl string. Returns null if malformed. */
function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  return { mimeType: match[1] ?? "image/jpeg", data: match[2] ?? "" };
}

/**
 * Build Anthropic SDK-compatible content blocks for a user message that includes images.
 * Images come first so Claude sees them before the accompanying text.
 */
function buildAnthropicUserContent(
  text: string,
  attachments: IncomingAttachment[]
): MessageParam["content"] {
  type AnthropicBlock =
    | { type: "text"; text: string }
    | {
        type: "image";
        source: {
          type: "base64";
          media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
          data: string;
        };
      };

  const blocks: AnthropicBlock[] = [];
  for (const att of attachments) {
    const parsed = parseDataUrl(att.dataUrl);
    if (!parsed) continue;
    const mediaType = parsed.mimeType as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";
    blocks.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: parsed.data },
    });
  }
  if (text.trim()) blocks.push({ type: "text", text: text.trim() });
  // Fall back to plain string if no valid blocks were produced
  return blocks.length ? (blocks as MessageParam["content"]) : text;
}

/**
 * Build Gemini SDK parts for a user message, including inline image data when present.
 */
function buildGeminiParts(
  text: string,
  attachments?: IncomingAttachment[]
): { text?: string; inlineData?: { mimeType: string; data: string } }[] {
  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [];
  if (attachments?.length) {
    for (const att of attachments) {
      const parsed = parseDataUrl(att.dataUrl);
      if (!parsed) continue;
      parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } });
    }
  }
  if (text.trim()) parts.push({ text: text.trim() });
  return parts.length ? parts : [{ text: text || "" }];
}

// ── Message preparation ────────────────────────────────────────────────────────

/**
 * Prepares messages for streaming.
 * - Grok (vision-capable models): embeds images as image_url parts (Chat Completions format).
 * - OpenAI: handled natively in streamOpenAI via the Responses API input_image type.
 * - Anthropic / Gemini: handled natively in their stream functions via vision blocks.
 */
export function prepareMessagesForStream(
  messagesIn: { role: "user" | "assistant" | "system"; content: string }[],
  attachments: IncomingAttachment[] | undefined,
  provider: string,
  model: string
): ChatMsg[] {
  const out: ChatMsg[] = messagesIn.map((m) => ({ role: m.role, content: m.content }));
  if (!attachments?.length) return out;
  const userIdx = [...out.keys()].filter((i) => out[i]!.role === "user").pop();
  if (userIdx === undefined) return out;
  const text = out[userIdx]!.content as string;

  if (provider === "grok" && grokSupportsVision(model)) {
    out[userIdx] = { role: "user", content: openAiImageParts(text, attachments) };
  }
  // OpenAI uses Responses API (handled in streamOpenAI).
  // Anthropic and Gemini use their own vision block builders in their stream fns.
  return out;
}

// ── Stream functions ───────────────────────────────────────────────────────────

export async function* streamAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  attachments?: IncomingAttachment[]
): AsyncGenerator<StreamChunk> {
  const client = new Anthropic({ apiKey });

  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => flattenMsgContent(m.content))
    .join("\n");

  const nonSystem = messages.filter((m) => m.role !== "system");
  // Index of the last user message — that's where we attach vision blocks
  const lastUserIdx = nonSystem.reduce((acc, m, i) => (m.role === "user" ? i : acc), -1);

  const msgs: MessageParam[] = nonSystem.map((m, idx) => {
    const isLastUser = m.role === "user" && idx === lastUserIdx && !!attachments?.length;
    if (isLastUser) {
      return {
        role: "user" as const,
        content: buildAnthropicUserContent(flattenMsgContent(m.content), attachments!),
      };
    }
    return {
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: flattenMsgContent(m.content),
    };
  });

  const stream = client.messages.stream({
    model,
    max_tokens: 8192,
    system: system || undefined,
    messages: msgs,
  });

  let inputTokens = 0;
  let outputTokens = 0;

  for await (const ev of stream) {
    if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
      yield { type: "text", text: ev.delta.text };
    }
    if (ev.type === "message_delta" && ev.usage) {
      outputTokens = ev.usage.output_tokens ?? outputTokens;
    }
    if (ev.type === "message_start" && ev.message.usage) {
      inputTokens = ev.message.usage.input_tokens ?? inputTokens;
    }
  }

  const final = await stream.finalMessage();
  inputTokens = final.usage.input_tokens;
  outputTokens = final.usage.output_tokens;
  yield { type: "usage", inputTokens, outputTokens };
}

function isOpenAiReasoningModel(model: string): boolean {
  const m = model.toLowerCase();
  return m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4");
}

// ── OpenAI Responses API ───────────────────────────────────────────────────────

type ResponsesInputContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

type ResponsesInputMessage = {
  role: "user" | "assistant";
  content: string | ResponsesInputContent[];
};

/**
 * OpenAI provider streaming via the Responses API (SDK ≥ 4.73).
 * Supports text, vision, and reasoning models natively.
 * System messages are sent as the `instructions` parameter.
 * Images are embedded as `input_image` content parts on the last user message.
 */
export async function* streamOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  attachments?: IncomingAttachment[]
): AsyncGenerator<StreamChunk> {
  const client = new OpenAI({ apiKey });
  const reasoning = isOpenAiReasoningModel(model);

  // System / developer messages → instructions string
  const instructions =
    messages
      .filter((m) => m.role === "system")
      .map((m) => flattenMsgContent(m.content))
      .join("\n") || undefined;

  // Non-system messages → Responses API input array
  const nonSystem = messages.filter((m) => m.role !== "system");
  const lastUserIdx = nonSystem.reduce((acc, m, i) => (m.role === "user" ? i : acc), -1);

  const input: ResponsesInputMessage[] = nonSystem.map((m, idx) => {
    const isLastUser = m.role === "user" && idx === lastUserIdx && !!attachments?.length;
    if (isLastUser) {
      const parts: ResponsesInputContent[] = [
        { type: "input_text", text: flattenMsgContent(m.content) || "Describe these images." },
        ...attachments!.map((a) => ({ type: "input_image" as const, image_url: a.dataUrl })),
      ];
      return { role: "user" as const, content: parts };
    }
    return {
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: flattenMsgContent(m.content),
    };
  });

  // The Responses API accepts `stream: true` and returns an async iterable of events.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream: AsyncIterable<any> = await (client as any).responses.create({
    model,
    input,
    ...(instructions ? { instructions } : {}),
    stream: true,
    max_output_tokens: reasoning ? 16384 : 8192,
  });

  let inputTokens = 0;
  let outputTokens = 0;

  for await (const event of stream) {
    // Text delta — streamed token
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
      yield { type: "text", text: event.delta };
    }
    // Final event — contains usage totals
    if (event.type === "response.completed") {
      const usage = event.response?.usage;
      if (usage) {
        inputTokens = usage.input_tokens ?? 0;
        outputTokens = usage.output_tokens ?? 0;
      }
    }
  }

  yield { type: "usage", inputTokens, outputTokens };
}

// ── OpenAI-compatible Chat Completions (Grok and other compatible providers) ──

export async function* streamOpenAICompatible(
  apiKey: string,
  baseURL: string | undefined,
  model: string,
  messages: ChatMsg[]
): AsyncGenerator<StreamChunk> {
  const client = new OpenAI({ apiKey, baseURL });
  const reasoning = isOpenAiReasoningModel(model);

  const stream = await client.chat.completions.create({
    model,
    messages: messages.map(
      (m) =>
        ({
          role: m.role,
          content: m.content,
        }) as OpenAI.Chat.Completions.ChatCompletionMessageParam
    ),
    stream: true,
    stream_options: { include_usage: true },
    ...(reasoning ? { max_completion_tokens: 8192 } : { max_tokens: 8192 }),
  });

  let inputTokens = 0;
  let outputTokens = 0;

  for await (const part of stream) {
    const ch = part.choices[0]?.delta?.content;
    if (typeof ch === "string" && ch) yield { type: "text", text: ch };
    if (part.usage) {
      inputTokens = part.usage.prompt_tokens ?? inputTokens;
      outputTokens = part.usage.completion_tokens ?? outputTokens;
    }
  }
  yield { type: "usage", inputTokens, outputTokens };
}

export async function* streamGemini(
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  attachments?: IncomingAttachment[]
): AsyncGenerator<StreamChunk> {
  const genAI = new GoogleGenerativeAI(apiKey);

  // Pull system messages out and pass them via systemInstruction (correct Gemini API usage)
  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => flattenMsgContent(m.content))
    .join("\n");

  const nonSystem = messages.filter((m) => m.role !== "system");
  const last = nonSystem[nonSystem.length - 1];
  if (!last || last.role !== "user") {
    throw new Error("Last message must be from the user for Gemini");
  }

  const geminiModel = genAI.getGenerativeModel({
    model,
    ...(systemText ? { systemInstruction: systemText } : {}),
  });

  // Conversation history = everything except the final user turn
  const history = nonSystem.slice(0, -1).map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: flattenMsgContent(msg.content) }],
  }));

  const chat = geminiModel.startChat({
    history: history as never,
    generationConfig: { maxOutputTokens: 8192 },
  });

  // Final user message — include vision inlineData if attachments are present
  const lastText = flattenMsgContent(last.content);
  const lastParts = buildGeminiParts(lastText, attachments);
  const result = await chat.sendMessageStream(lastParts as never);

  let inputTokens = 0;
  let outputTokens = 0;

  for await (const chunk of result.stream) {
    const t = chunk.text();
    if (t) yield { type: "text", text: t };
    const u = chunk.usageMetadata;
    if (u) {
      inputTokens = u.promptTokenCount ?? inputTokens;
      outputTokens = u.candidatesTokenCount ?? outputTokens;
    }
  }
  yield { type: "usage", inputTokens, outputTokens };
}

// ── Image generation ───────────────────────────────────────────────────────────

export type GeneratedImageInfo = { dataUrlOrHttp: string; model: string };

/**
 * Images API — prefers gpt-image-1, falls back to dall-e-3.
 * Supports url or b64_json in the response.
 */
export async function generateOpenAIImage(
  apiKey: string,
  prompt: string
): Promise<GeneratedImageInfo> {
  const client = new OpenAI({ apiKey });
  const p = prompt.slice(0, 4000);
  const models = ["gpt-image-1", "dall-e-3"] as const;
  let lastErr: Error | null = null;

  for (const imageModel of models) {
    try {
      const res = await client.images.generate({
        model: imageModel,
        prompt: p,
        n: 1,
        size: "1024x1024",
        ...(imageModel === "dall-e-3" ? { response_format: "url" as const } : {}),
      });
      const row = res.data?.[0];
      if (row?.url) return { dataUrlOrHttp: row.url, model: imageModel };
      if (row?.b64_json) {
        return {
          dataUrlOrHttp: `data:image/png;base64,${row.b64_json}`,
          model: imageModel,
        };
      }
      throw new Error("OpenAI returned no image url or base64 data");
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw new Error(
    `${lastErr?.message ?? "Image generation failed"} (tried gpt-image-1 and dall-e-3). ` +
      `Check API access, billing, and model availability.`
  );
}
