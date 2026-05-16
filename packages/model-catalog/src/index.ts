/**
 * Single source of truth for provider + model IDs exposed in SolveGPT.
 * IDs match each vendor's public API (Anthropic Messages, OpenAI Chat Completions,
 * xAI OpenAI-compatible, Google Generative AI).
 */

export type ProviderId = "anthropic" | "openai" | "grok" | "gemini";

export type ModelEntry = {
  id: string;
  label: string;
  /** Rough USD per 1M tokens (input / output) for usage estimates */
  costPer1M?: { in: number; out: number };
};

export const PROVIDERS: { id: ProviderId; label: string; hint: string }[] = [
  { id: "anthropic", label: "Claude", hint: "Anthropic Messages API" },
  { id: "openai", label: "ChatGPT", hint: "OpenAI — say “make an image of…” for image generation" },
  { id: "grok", label: "Grok", hint: "xAI (OpenAI-compatible)" },
  { id: "gemini", label: "Gemini", hint: "Google Generative AI" },
];

export const MODEL_CATALOG: Record<ProviderId, ModelEntry[]> = {
  anthropic: [
    { id: "claude-opus-4-6", label: "Claude Opus 4.6", costPer1M: { in: 5, out: 25 } },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", costPer1M: { in: 3, out: 15 } },
    { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", costPer1M: { in: 3, out: 15 } },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", costPer1M: { in: 1, out: 5 } },
    { id: "claude-opus-4-5-20251101", label: "Claude Opus 4.5", costPer1M: { in: 5, out: 25 } },
  ],
  openai: [
    { id: "gpt-4.1", label: "GPT-4.1", costPer1M: { in: 2, out: 8 } },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini", costPer1M: { in: 0.4, out: 1.6 } },
    { id: "gpt-4.1-nano", label: "GPT-4.1 nano", costPer1M: { in: 0.1, out: 0.4 } },
    { id: "gpt-4o", label: "GPT-4o", costPer1M: { in: 2.5, out: 10 } },
    { id: "gpt-4o-mini", label: "GPT-4o mini", costPer1M: { in: 0.15, out: 0.6 } },
    { id: "o4-mini", label: "o4-mini (reasoning)", costPer1M: { in: 1.1, out: 4.4 } },
    { id: "o3-mini", label: "o3-mini (reasoning)", costPer1M: { in: 1.1, out: 4.4 } },
  ],
  grok: [
    { id: "grok-4.3", label: "Grok 4.3", costPer1M: { in: 1.25, out: 2.5 } },
    { id: "grok-3", label: "Grok 3", costPer1M: { in: 3, out: 15 } },
    { id: "grok-3-mini", label: "Grok 3 mini", costPer1M: { in: 0.3, out: 0.5 } },
    { id: "grok-code-fast-1", label: "Grok Code Fast", costPer1M: { in: 0.2, out: 1.5 } },
  ],
  gemini: [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", costPer1M: { in: 1.25, out: 10 } },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", costPer1M: { in: 0.3, out: 2.5 } },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", costPer1M: { in: 0.1, out: 0.4 } },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", costPer1M: { in: 0.1, out: 0.4 } },
    { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash-Lite", costPer1M: { in: 0.075, out: 0.3 } },
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview)", costPer1M: { in: 2, out: 12 } },
    { id: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash-Lite (preview)", costPer1M: { in: 0.1, out: 0.4 } },
  ],
};

/** Flat list for admin allowlist and validation */
export const ALL_MODEL_IDS = new Set(
  (Object.entries(MODEL_CATALOG) as [ProviderId, ModelEntry[]][]).flatMap(([p, models]) =>
    models.map((m) => `${p}:${m.id}`)
  )
);

export function isKnownModel(provider: ProviderId, modelId: string): boolean {
  return MODEL_CATALOG[provider]?.some((m) => m.id === modelId) ?? false;
}

export function defaultModelForProvider(provider: ProviderId): string {
  return MODEL_CATALOG[provider][0]!.id;
}

export function costEstimatePer1M(modelId: string): { in: number; out: number } {
  for (const models of Object.values(MODEL_CATALOG)) {
    const row = models.find((m) => m.id === modelId);
    if (row?.costPer1M) return row.costPer1M;
  }
  return { in: 1, out: 3 };
}

/** UI shape used by the web app composer */
export const MODELS: Record<ProviderId, { id: string; label: string }[]> = Object.fromEntries(
  (Object.entries(MODEL_CATALOG) as [ProviderId, ModelEntry[]][]).map(([p, entries]) => [
    p,
    entries.map(({ id, label }) => ({ id, label })),
  ])
) as Record<ProviderId, { id: string; label: string }[]>;
