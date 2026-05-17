/**
 * Smart middleware — detect image-generation vs chat intent for routing.
 * Rule-based (fast) with optional LLM refinement via OPENAI_ROUTE_IMAGE_LLM=1.
 */

import OpenAI from "openai";

// ── Vocabulary ─────────────────────────────────────────────────────────────────

/** Action verbs that signal the user wants something created. */
const CREATE_VERBS =
  /\b(generate|create|make|draw|render|paint|design|produce|build|show|give|illustrate|compose)\b/i;

/** Visual content nouns — any of these alone with a create-verb signals image intent. */
const VISUAL_NOUNS =
  /\b(image|picture|photo|photograph|illustration|artwork|drawing|pic|poster|banner|logo|flyer|leaflet|thumbnail|infographic|avatar|wallpaper|background|meme|sticker|icon|graphic|mockup|cover|badge|card|cartoon|sketch|render|painting|portrait|landscape|scene|visualization|art|design)\b/i;

/** Explicit negation — override everything. */
const NEGATION = /\b(do not|don't|dont|never|avoid)\s+(generate|create|draw|make|design)\b/i;

// ── Detection ──────────────────────────────────────────────────────────────────

export type StreamIntent = "image" | "chat";

function detectIntentRuleBased(userText: string): StreamIntent {
  const t = userText.trim();
  if (!t) return "chat";
  if (NEGATION.test(t)) return "chat";

  const lower = t.toLowerCase();

  // Explicit DALL·E / GPT-Image mentions always mean image generation
  if (/\bdall-?e\b/i.test(t) || /\bgpt-?image\b/i.test(t)) return "image";

  // "draw X" at the very start of the message
  if (/^draw\s+/im.test(t)) return "image";

  // Any create-verb + any visual noun → image
  if (CREATE_VERBS.test(lower) && VISUAL_NOUNS.test(lower)) return "image";

  // Verb + "me" + visual noun (e.g. "show me a picture of…")
  if (/\b(show|give)\s+me\s+(a|an|the)\s+/i.test(t) && VISUAL_NOUNS.test(lower)) return "image";

  // "visualize (as|this|the)" construction
  if (/\bvisuali[sz]e\s+(as|this|the)\b/i.test(t)) return "image";

  return "chat";
}

export function detectStreamIntent(userText: string): StreamIntent {
  return detectIntentRuleBased(userText);
}

/** @deprecated use detectStreamIntent */
export function detectOpenAIImageIntent(userText: string): boolean {
  return detectStreamIntent(userText) === "image";
}

// ── Prompt cleaning ────────────────────────────────────────────────────────────

/** Strip leading command phrases; return whatever the user actually wants depicted. */
export function extractImagePrompt(raw: string): string {
  let s = raw.trim().replace(/\s+/g, " ");
  for (let i = 0; i < 10; i++) {
    const before = s;
    s = s.replace(/^(please\s+|can you\s+|could you\s+)/i, "").trim();
    s = s.replace(/^(i want (you )?to\s+|i'd like\s+|i need\s+)/i, "").trim();
    s = s
      .replace(
        /^(generate|create|make|draw|render|paint|design|produce|show|give|illustrate|compose)\s+(me\s+)?((a|an|the)\s+)?(image|picture|photo|photograph|illustration|artwork|drawing|pic|poster|banner|logo|flyer|leaflet|thumbnail|infographic|avatar|wallpaper|background|meme|sticker|icon|graphic|mockup|cover|badge|card|cartoon|sketch|render|painting|portrait|landscape|scene|visualization|art|design)\s*(of|for|about|showing|depicting|featuring|with|that shows|:|-|,)?\s*/i,
        ""
      )
      .trim();
    s = s.replace(/^draw\s+/i, "").trim();
    if (s === before) break;
  }
  return (s || raw.trim()).slice(0, 4000);
}

/**
 * Build the final prompt sent to the Images API.
 * Pass the user's intent through cleanly — modern image models handle
 * natural language prompts well without artificial framing.
 */
export function buildDallePrompt(extracted: string, originalUserText: string): string {
  return (extracted.trim() || originalUserText.trim()).slice(0, 4000);
}

// ── Optional LLM disambiguation ────────────────────────────────────────────────

const INTENT_MODEL = process.env.OPENAI_INTENT_MODEL ?? "gpt-4o-mini";

/**
 * LLM-based intent classification (optional, activated via OPENAI_ROUTE_IMAGE_LLM=1).
 * Uses a dedicated OpenAI key so it works regardless of the current chat provider.
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
- IMAGE — user wants to generate, draw, create, render, illustrate, design, or visualize a new image / art / picture / poster / banner / logo / flyer / thumbnail / graphic.
- CHAT — questions, coding, analysis, editing existing images without requesting new generation.

No punctuation or other words.`,
      },
      { role: "user", content: userText.slice(0, 2000) },
    ],
    max_tokens: 8,
    temperature: 0,
  });
  const out = res.choices[0]?.message?.content?.trim().toUpperCase() ?? "CHAT";
  return out.startsWith("IMAGE") ? "image" : "chat";
}
