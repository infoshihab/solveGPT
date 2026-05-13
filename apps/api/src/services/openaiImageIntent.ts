/**
 * Smart middleware — Step 1: detect image vs chat for OpenAI routing.
 * Rule-based (fast) with optional LLM refine via OPENAI_ROUTE_IMAGE_LLM=1.
 */

import OpenAI from "openai";

const NEGATION = /\b(do not|don't|dont|never|avoid)\s+(generate|create|draw|make)\b/i;

/** Tighter patterns (fewer false positives). */
const INTENT_PATTERNS: RegExp[] = [
  /\b(generate|create|make|draw|render|paint)\s+(me\s+)?((a|an|the)\s+)?(image|picture|photo|illustration|artwork|drawing|pic)\b/i,
  /\b(give|show)\s+me\s+((a|an|the)\s+)?(image|picture|photo|pic)\b/i,
  /^draw\s+/im,
  /\bdall-?e\b/i,
  /\bgpt-?image\b/i,
  /\bvisuali[sz]e\s+(as|this|the)\b/i,
];

export type StreamIntent = "image" | "chat";

/**
 * Beginner-friendly broad rules (user spec) + word boundaries where it matters.
 * "withdraw" must not match "draw" as a whole word — use \\bdraw\\b.
 */
function detectIntentRuleBased(userText: string): StreamIntent {
  const t = userText.trim();
  if (!t) return "chat";
  if (NEGATION.test(t)) return "chat";

  const lower = t.toLowerCase();

  if (
    lower.includes("create picture") ||
    lower.includes("create an image") ||
    lower.includes("create a image") ||
    lower.includes("make a image") ||
    lower.includes("make an image") ||
    lower.includes("generate image") ||
    lower.includes("generate an image") ||
    lower.includes("generate a image")
  ) {
    return "image";
  }

  if (/\bgenerate\b/.test(lower) && /\b(image|picture|photo|illustration|artwork|drawing)\b/.test(lower)) {
    return "image";
  }

  if (/\bdraw\b/.test(lower) && (/\b(image|picture|photo|illustration|drawing)\b/.test(lower) || /^draw\s+/im.test(t))) {
    return "image";
  }

  if (
    (/\bimage\b/.test(lower) || /\bpicture\b/.test(lower) || /\bphoto\b/.test(lower)) &&
    /\b(make|create|generate|draw|render|paint|show|give|design|build)\b/i.test(lower) &&
    /\b(of|for)\b/.test(lower)
  ) {
    return "image";
  }

  if (INTENT_PATTERNS.some((p) => p.test(t))) return "image";

  return "chat";
}

export function detectStreamIntent(userText: string): StreamIntent {
  return detectIntentRuleBased(userText);
}

/** @deprecated use detectStreamIntent */
export function detectOpenAIImageIntent(userText: string): boolean {
  return detectStreamIntent(userText) === "image";
}

/** Strip common command phrases; fall back to full text if nothing remains. */
export function extractImagePrompt(raw: string): string {
  let s = raw.trim().replace(/\s+/g, " ");
  for (let i = 0; i < 8; i++) {
    const before = s;
    s = s.replace(/^(please\s+|can you\s+|could you\s+)/i, "").trim();
    s = s.replace(/^(i want (you )?to\s+|i'd like\s+)/i, "").trim();
    s = s
      .replace(
        /^(generate|create|make|draw|render|paint|give|show)\s+(me\s+)?((a|an|the)\s+)?(image|picture|photo|illustration|artwork|drawing|pic)\s*(of|for|showing|:|,|-)?\s*/i,
        ""
      )
      .trim();
    s = s.replace(/^draw\s+/i, "").trim();
    if (s === before) break;
  }
  return (s || raw.trim()).slice(0, 4000);
}

/** Short prompts: add safe illustrative framing for DALL·E / GPT Image. */
export function buildDallePrompt(extracted: string, originalUserText: string): string {
  const base = (extracted.trim() || originalUserText.trim()).slice(0, 4000);
  if (base.length < 20) {
    return (
      "Stylized flat illustration for a product mockup, fictional UI, no real logos or credentials: " +
      base
    ).slice(0, 4000);
  }
  return base;
}

const INTENT_MODEL = process.env.OPENAI_INTENT_MODEL ?? "gpt-4o-mini";

/**
 * Step 1b (optional): LLM disambiguation when OPENAI_ROUTE_IMAGE_LLM=1.
 * Reply must start with IMAGE or CHAT.
 */
export async function classifyIntentWithOpenAI(
  apiKey: string,
  userText: string
): Promise<StreamIntent> {
  const client = new OpenAI({ apiKey });
  const res = await client.chat.completions.create({
    model: INTENT_MODEL,
    messages: [
      {
        role: "system",
        content: `You route user messages for a product that can either (A) generate a new image with an image API, or (B) answer with normal chat text.
Reply with exactly one word:
- IMAGE — user wants to generate, draw, create, render, illustrate, or visualize a new image/art/picture/photo (including "make an image of…", DALL·E, GPT image).
- CHAT — questions, coding, explanations, analysis, or talking about images without requesting new generation.

No punctuation or other words.`,
      },
      { role: "user", content: userText.slice(0, 2000) },
    ],
    max_tokens: 8,
    temperature: 0,
  });
  const out = res.choices[0]?.message?.content?.trim().toUpperCase() ?? "CHAT";
  if (out.startsWith("IMAGE")) return "image";
  return "chat";
}
