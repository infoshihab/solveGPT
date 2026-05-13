import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

const roughCostPer1M: Record<string, { in: number; out: number }> = {
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "claude-3-5-sonnet-20241022": { in: 3, out: 15 },
  "claude-3-5-haiku-20241022": { in: 0.8, out: 4 },
  "grok-2-latest": { in: 2, out: 10 },
  "gemini-1.5-pro": { in: 1.25, out: 5 },
  "gemini-1.5-flash": { in: 0.075, out: 0.3 },
};

export function estimateCostUsd(model: string, input: number, output: number): number {
  const p = roughCostPer1M[model] ?? { in: 1, out: 3 };
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

function openAiSupportsVision(model: string): boolean {
  const m = model.toLowerCase();
  if (m.startsWith("gpt-3.5")) return false;
  return m.includes("gpt-4") || m.includes("gpt-5") || m.includes("chatgpt") || m.includes("o4");
}

function openAiImageParts(text: string, files: IncomingAttachment[]): ChatCompletionContentPart[] {
  const parts: ChatCompletionContentPart[] = [
    { type: "text", text: text.trim() || "Please describe these images." },
  ];
  for (const f of files) {
    parts.push({ type: "image_url", image_url: { url: f.dataUrl } });
  }
  return parts;
}

/** Merges optional file attachments into the last user message for the model stream. */
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
  if (provider === "openai" && openAiSupportsVision(model)) {
    out[userIdx] = { role: "user", content: openAiImageParts(text, attachments) };
  } else {
    out[userIdx] = { role: "user", content: mergeUserContentForDb(text, attachments) };
  }
  return out;
}

export async function* streamAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMsg[]
): AsyncGenerator<StreamChunk> {
  const client = new Anthropic({ apiKey });
  const system = messages.filter((m) => m.role === "system").map((m) => flattenMsgContent(m.content)).join("\n");
  const msgs: MessageParam[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: flattenMsgContent(m.content),
    }));

  const stream = client.messages.stream({
    model,
    max_tokens: 4096,
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

export async function* streamOpenAICompatible(
  apiKey: string,
  baseURL: string | undefined,
  model: string,
  messages: ChatMsg[]
): AsyncGenerator<StreamChunk> {
  const client = new OpenAI({ apiKey, baseURL });
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
  messages: ChatMsg[]
): AsyncGenerator<StreamChunk> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const m = genAI.getGenerativeModel({ model });
  const history = messages.slice(0, -1).map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: flattenMsgContent(msg.content) }],
  }));
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") {
    throw new Error("Last message must be user for Gemini");
  }
  const chat = m.startChat({ history: history as never });
  const result = await chat.sendMessageStream(flattenMsgContent(last.content));

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

export type GeneratedImageInfo = { dataUrlOrHttp: string; model: string };

/**
 * Images API — prefers gpt-image-1 (ChatGPT-class image gen), falls back to dall-e-3.
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
      if (row?.url) {
        return { dataUrlOrHttp: row.url, model: imageModel };
      }
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

  const msg = lastErr?.message ?? "Image generation failed";
  throw new Error(
    `${msg} (tried gpt-image-1 and dall-e-3). Check API access, billing, and model availability.`
  );
}
