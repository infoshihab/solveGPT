import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

export type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

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

export async function* streamAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMsg[]
): AsyncGenerator<StreamChunk> {
  const client = new Anthropic({ apiKey });
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const msgs: MessageParam[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
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
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    stream: true,
    stream_options: { include_usage: true },
  });

  let inputTokens = 0;
  let outputTokens = 0;

  for await (const part of stream) {
    const ch = part.choices[0]?.delta?.content;
    if (ch) yield { type: "text", text: ch };
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
    parts: [{ text: msg.content }],
  }));
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") {
    throw new Error("Last message must be user for Gemini");
  }
  const chat = m.startChat({ history: history as never });
  const result = await chat.sendMessageStream(last.content);

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

/** DALL·E 3 — requires OpenAI API key (chat provider "openai"). */
export async function generateOpenAIImage(apiKey: string, prompt: string): Promise<string> {
  const client = new OpenAI({ apiKey });
  const res = await client.images.generate({
    model: "dall-e-3",
    prompt: prompt.slice(0, 4000),
    n: 1,
    size: "1024x1024",
  });
  const url = res.data?.[0]?.url;
  if (!url) throw new Error("OpenAI did not return an image URL");
  return url;
}
