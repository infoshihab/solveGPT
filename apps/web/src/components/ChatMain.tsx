"use client";

import { useCallback, useMemo, useState } from "react";
import { MODELS, PROVIDERS, type ProviderId } from "@/lib/models";
import { apiFetch, getStoredToken, streamChat } from "@/lib/api";
import { useChatStore } from "@/store/chatStore";
import { TemplatesPanel } from "@/components/TemplatesPanel";
import { MarkdownMessage } from "@/components/MarkdownMessage";

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
    setMessages,
    addUserMessage,
    addAssistantMessage,
    appendAssistantChunk,
    setStreaming,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);

  const modelOptions = useMemo(() => MODELS[provider], [provider]);

  const reloadConversation = useCallback(
    async (id: string) => {
      const res = await apiFetch(`/api/chat/conversations/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages: { role: string; content: string }[];
      };
      setMessages(
        data.messages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }))
      );
    },
    [setMessages]
  );

  const send = async () => {
    const text = input.trim();
    if (!text || streaming || imageBusy) return;
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
      await streamChat(
        {
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

  const generateImage = async () => {
    const prompt = input.trim();
    if (!prompt || streaming || imageBusy) {
      setError(prompt ? null : "Describe the image in the box, then click Create image.");
      return;
    }
    setError(null);
    setImageBusy(true);
    if (!getStoredToken()) {
      setError("Not signed in");
      setImageBusy(false);
      return;
    }
    try {
      const res = await apiFetch("/api/chat/generate-image", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          conversationId: conversationId ?? undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { error?: string }).error ?? "Image generation failed");
      }
      const { url } = body as { url: string };
      setInput("");
      if (conversationId) {
        await reloadConversation(conversationId);
      } else {
        addUserMessage(`Create image: ${prompt}`);
        addAssistantMessage(`![Generated](${url})`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image request failed");
    } finally {
      setImageBusy(false);
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

  const busy = streaming || imageBusy;

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-surface">
      <header className="flex flex-wrap items-center gap-3 border-b border-surface-border bg-surface-raised/50 px-4 py-3 backdrop-blur-sm">
        <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          <span className="mb-1 block">Provider</span>
          <select
            value={provider}
            disabled={busy}
            onChange={(e) => setProvider(e.target.value as ProviderId)}
            className="rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-zinc-100 shadow-sm outline-none ring-1 ring-transparent focus:ring-accent/50"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          <span className="mb-1 block">Model</span>
          <select
            value={model}
            disabled={busy}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-zinc-100 shadow-sm outline-none ring-1 ring-transparent focus:ring-accent/50"
          >
            {modelOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {usage && (
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
            {usage}
          </span>
        )}
        {conversationId && (
          <button
            type="button"
            onClick={() => void exportConversation()}
            className="ml-auto rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Export JSON
          </button>
        )}
      </header>

      <TemplatesPanel onInsert={(text) => setInput((prev) => (prev ? `${prev}\n\n${text}` : text))} />

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-8">
        {messages.length === 0 && (
          <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-surface-border bg-surface-raised/40 px-6 py-10 text-center">
            <p className="text-sm font-medium text-zinc-300">Start a conversation</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Pick a provider and model, type your question, or describe an image and use{" "}
              <strong className="text-zinc-400">Create image</strong> (uses OpenAI DALL·E 3 — requires an OpenAI key in
              Admin).
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={`${i}-${m.role}`}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[min(760px,94%)] rounded-2xl border px-4 py-3 shadow-sm ${
                m.role === "user"
                  ? "border-blue-500/25 bg-gradient-to-br from-blue-600/25 to-indigo-900/20 text-zinc-100"
                  : m.role === "system"
                    ? "border-amber-500/30 bg-amber-500/5 text-amber-100"
                    : "border-surface-border bg-surface-raised text-zinc-100"
              }`}
            >
              <div className="mb-2 flex items-center gap-2 border-b border-white/5 pb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {m.role === "user" ? "You" : m.role === "assistant" ? "Assistant" : m.role}
                </span>
              </div>
              <MarkdownMessage content={m.content} />
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="border-t border-red-500/25 bg-red-950/40 px-4 py-2.5 text-sm text-red-100">{error}</div>
      )}

      <footer className="border-t border-surface-border bg-surface-raised/30 p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200">
              Attach file
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => attachFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              disabled={busy || !input.trim()}
              onClick={() => void generateImage()}
              className="rounded-lg border border-violet-500/40 bg-violet-600/15 px-3 py-1.5 text-xs font-medium text-violet-200 transition hover:bg-violet-600/25 disabled:opacity-40"
              title="Uses OpenAI DALL·E 3 (OpenAI API key required)"
            >
              {imageBusy ? "Creating image…" : "Create image (DALL·E)"}
            </button>
            <span className="text-[11px] text-zinc-600">Code & markdown render below. Images need the button or an OpenAI key.</span>
          </div>
          <div className="flex gap-3">
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
              placeholder="Write a message… (Shift+Enter for new line). For code, the assistant will use fenced blocks."
              className="min-h-[96px] flex-1 resize-none rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 shadow-inner outline-none ring-1 ring-transparent transition focus:border-accent/50 focus:ring-accent/30"
              disabled={streaming}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={streaming || !input.trim()}
              className="self-end shrink-0 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-900/20 transition hover:bg-blue-500 disabled:opacity-40"
            >
              {streaming ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </footer>
    </section>
  );
}
