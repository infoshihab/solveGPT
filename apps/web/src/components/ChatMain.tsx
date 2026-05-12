"use client";

import { useCallback, useMemo, useState } from "react";
import { MODELS, PROVIDERS, type ProviderId } from "@/lib/models";
import { apiFetch, getStoredToken, streamChat } from "@/lib/api";
import { useChatStore } from "@/store/chatStore";
import { TemplatesPanel } from "@/components/TemplatesPanel";

export function ChatMain() {
  const {
    messages,
    provider,
    model,
    conversationId,
    streaming,
    setProvider,
    setModel,
    setConversationId,
    addUserMessage,
    appendAssistantChunk,
    setStreaming,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<string | null>(null);

  const modelOptions = useMemo(() => MODELS[provider], [provider]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setError(null);
    setUsage(null);
    addUserMessage(text);
    setStreaming(true);
    if (!getStoredToken()) {
      setError("Not signed in");
      setStreaming(false);
      return;
    }
    const payloadMessages = [...useChatStore.getState().messages];
    try {
      await streamChat({
        conversationId: conversationId ?? undefined,
        provider,
        model,
        messages: payloadMessages,
      },
        (ev) => {
          if (ev.type === "meta") {
            setConversationId(ev.conversationId);
          } else if (ev.type === "token") {
            appendAssistantChunk(ev.text);
          } else if (ev.type === "done") {
            setUsage(
              `Tokens in/out: ${ev.usage.inputTokens} / ${ev.usage.outputTokens} · ~$${ev.usage.costUsd.toFixed(4)}`
            );
          } else if (ev.type === "error") {
            setError(ev.message);
          }
        }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setStreaming(false);
    }
  };

  const attachFile = useCallback((file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      setInput((prev) => `${prev ? `${prev}\n\n` : ""}![upload](${url})`);
    };
    reader.readAsDataURL(file);
  }, []);

  const exportConversation = async () => {
    if (!conversationId) return;
    if (!getStoredToken()) return;
    const res = await apiFetch(`/api/chat/conversations/${conversationId}/export.json`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solvegpt-${conversationId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-surface-border bg-surface/80 px-4 py-3 backdrop-blur">
        <label className="text-xs text-zinc-500">
          Provider
          <select
            value={provider}
            disabled={streaming}
            onChange={(e) => setProvider(e.target.value as ProviderId)}
            className="ml-1 rounded border border-surface-border bg-surface-raised px-2 py-1 text-sm text-white"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-500">
          Model
          <select
            value={model}
            disabled={streaming}
            onChange={(e) => setModel(e.target.value)}
            className="ml-1 rounded border border-surface-border bg-surface-raised px-2 py-1 text-sm text-white"
          >
            {modelOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {usage && <span className="text-xs text-emerald-400">{usage}</span>}
        {conversationId && (
          <button
            type="button"
            onClick={() => void exportConversation()}
            className="ml-auto text-xs text-accent hover:underline"
          >
            Export JSON
          </button>
        )}
      </header>

      <TemplatesPanel onInsert={(text) => setInput((prev) => (prev ? `${prev}\n\n${text}` : text))} />

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <p className="text-center text-sm text-zinc-500">
            Choose a provider and model, then send a message. Your history stays private to your account.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={`${i}-${m.role}`}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[min(720px,92%)] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-accent/20 text-blue-50"
                  : m.role === "system"
                    ? "border border-amber-500/30 bg-amber-500/10 text-amber-100"
                    : "bg-surface-raised text-zinc-100"
              }`}
            >
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                {m.role}
              </div>
              <MessageBody content={m.content} />
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="border-t border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">{error}</div>
      )}

      <footer className="border-t border-surface-border p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded-md border border-surface-border px-2 py-1 text-xs text-zinc-400 hover:bg-surface-raised">
              Image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => attachFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={3}
              placeholder="Message… (Shift+Enter for newline)"
              className="min-h-[88px] flex-1 resize-none rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-sm text-white outline-none ring-accent focus:ring-1"
              disabled={streaming}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={streaming || !input.trim()}
              className="self-end rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
            >
              {streaming ? "…" : "Send"}
            </button>
          </div>
        </div>
      </footer>
    </section>
  );
}

function MessageBody({ content }: { content: string }) {
  const parts = content.split(/(!\[.*?\]\([^)]+\))/g);
  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        const img = part.match(/^!\[(.*?)\]\((data:image[^)]+)\)$/);
        if (img) {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={img[2]} alt={img[1] || "attachment"} className="max-h-64 rounded-lg border border-surface-border" />
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap break-words">
            {part}
          </p>
        );
      })}
    </div>
  );
}
