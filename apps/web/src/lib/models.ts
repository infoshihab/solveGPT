export type ProviderId = "anthropic" | "openai" | "grok" | "gemini";

export const PROVIDERS: { id: ProviderId; label: string; hint: string }[] = [
  { id: "anthropic", label: "Claude", hint: "Anthropic Messages API" },
  { id: "openai", label: "ChatGPT", hint: "OpenAI Chat Completions" },
  { id: "grok", label: "Grok", hint: "xAI (OpenAI-compatible)" },
  { id: "gemini", label: "Gemini", hint: "Google Generative AI" },
];

export const MODELS: Record<ProviderId, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o mini" },
  ],
  grok: [{ id: "grok-2-latest", label: "Grok 2" }],
  gemini: [
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
  ],
};
