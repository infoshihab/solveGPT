const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const TOKEN_KEY = "solvegpt_token";

export function apiBase() {
  return API.replace(/\/$/, "");
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const t = getStoredToken();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  if (!headers.has("Content-Type") && init?.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${apiBase()}${path}`, { ...init, headers });
}

export type StreamEvent =
  | { type: "meta"; conversationId: string; provider: string; model: string }
  | { type: "token"; text: string }
  | { type: "result"; kind: "image" | "chat"; data: string }
  | {
      type: "done";
      usage: { inputTokens: number; outputTokens: number; costUsd: number };
    }
  | { type: "error"; message: string };

export async function streamChat(
  body: Record<string, unknown>,
  onEvent: (ev: StreamEvent) => void
): Promise<void> {
  const res = await apiFetch("/api/chat/stream", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .find((l) => l.startsWith("data: "));
      if (!line) continue;
      const data = line.slice("data: ".length).trim();
      if (!data || data === "[DONE]") continue;
      try {
        onEvent(JSON.parse(data) as StreamEvent);
      } catch {
        /* ignore parse errors from partial frames */
      }
    }
  }
}
