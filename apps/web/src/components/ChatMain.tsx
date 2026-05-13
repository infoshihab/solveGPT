"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MODELS, PROVIDERS, type ProviderId } from "@/lib/models";
import { apiFetch, getStoredToken, streamChat } from "@/lib/api";
import { useChatStore, type ChatMessage } from "@/store/chatStore";
import { TemplatesPanel } from "@/components/TemplatesPanel";
import { MarkdownMessage } from "@/components/MarkdownMessage";

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-1 py-0.5 text-xs text-zinc-500">
      <span className="text-zinc-500">Thinking</span>
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1 w-1 rounded-full bg-zinc-500"
            style={{
              animation: "typing-dot 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </span>
    </div>
  );
}

function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="max-w-[min(680px,90%)] rounded-2xl border border-zinc-700/45 bg-zinc-800/35 px-4 py-2.5">
      {message.attachments && message.attachments.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {message.attachments.map((a) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={a.id}
              src={a.dataUrl}
              alt={a.name}
              className="max-h-40 max-w-full rounded-lg border border-zinc-600/40 object-cover"
            />
          ))}
        </div>
      )}
      {message.content.trim() ? (
        /!\[[^\]]*\]\([^)]+\)/.test(message.content) ||
        /^#{1,6}\s/m.test(message.content) ||
        message.content.includes("```") ? (
          <MarkdownMessage content={message.content} />
        ) : (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-zinc-100">{message.content}</p>
        )
      ) : message.attachments?.length ? (
        <p className="text-xs text-zinc-500">Photo attached</p>
      ) : null}
    </div>
  );
}

export function ChatMain() {
  const {
    messages,
    provider,
    model,
    conversationId,
    streaming,
    pendingAttachments,
    setProvider,
    setModel,
    setConversationId,
    setMessages,
    addUserMessage,
    addAssistantMessage,
    appendAssistantChunk,
    setStreaming,
    addPendingAttachment,
    removePendingAttachment,
    clearPendingAttachments,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  const scrollChatToBottom = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, []);

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
    const snap = [...useChatStore.getState().pendingAttachments];
    if ((!text && !snap.length) || streaming || imageBusy) return;
    setInput("");
    clearPendingAttachments();
    setError(null);
    setUsage(null);
    addUserMessage(text, snap.length ? snap : undefined);
    setStreaming(true);
    if (!getStoredToken()) {
      setError("Not signed in");
      setStreaming(false);
      return;
    }
    const payloadMessages = useChatStore.getState().messages.map(({ role, content }) => ({ role, content }));
    try {
      await streamChat(
        {
          conversationId: conversationId ?? undefined,
          provider,
          model,
          messages: payloadMessages,
          attachments: snap.length
            ? snap.map(({ name, mime, dataUrl }) => ({ name, mime, dataUrl }))
            : undefined,
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

  const attachFile = useCallback(
    (file: File | null) => {
      if (!file || !file.type.startsWith("image/")) return;
      if (file.size > 10 * 1024 * 1024) {
        setError("Each image must be under 10 MB.");
        return;
      }
      setError(null);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? "");
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;
        addPendingAttachment({ id, name: file.name || "image", mime: file.type, dataUrl });
      };
      reader.readAsDataURL(file);
    },
    [addPendingAttachment]
  );

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
  const last = messages[messages.length - 1];
  const showTyping = streaming && last?.role === "user";
  const showEmptyState = messages.length === 0;

  useEffect(() => {
    scrollChatToBottom();
  }, [messages, streaming, showTyping, scrollChatToBottom]);

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

      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto w-full max-w-4xl space-y-5">
          {showEmptyState && (
            <div className="rounded-2xl border border-dashed border-surface-border bg-surface-raised/30 px-6 py-9 text-center">
              <p className="text-sm font-medium text-zinc-300">New chat</p>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
                Ask anything below. Add images from the toolbar; use image create only when you want DALL·E output.
              </p>
            </div>
          )}
        {messages.map((m, i) => (
          <div
            key={`msg-${i}`}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "user" ? (
              <UserBubble message={m} />
            ) : (
              <div
                className={`max-w-[min(720px,100%)] rounded-2xl px-4 py-3 ${
                  m.role === "system"
                    ? "border border-amber-500/25 bg-amber-950/20 text-amber-50"
                    : "border border-zinc-800/60 bg-zinc-900/25"
                }`}
              >
                {m.role === "system" && (
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-amber-200/70">System</p>
                )}
                <div className="max-w-full">
                  <MarkdownMessage content={m.content} />
                  {streaming && i === messages.length - 1 && m.role === "assistant" && (
                    <span
                      className="ml-0.5 inline-block h-4 w-0.5 animate-pulse rounded-sm bg-zinc-400 align-text-bottom"
                      aria-hidden
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {showTyping && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/25 px-4 py-2.5">
              <TypingIndicator />
            </div>
          </div>
        )}
        </div>
      </div>

      {error && (
        <div className="border-t border-red-500/25 bg-red-950/40 px-4 py-2.5 text-sm text-red-100">{error}</div>
      )}

      <footer className="border-t border-surface-border bg-surface px-4 py-3 md:px-6 md:py-4">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-2.5">
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingAttachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-2 py-1.5 pr-1"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.dataUrl} alt="" className="h-9 w-9 rounded-md object-cover" />
                  <span className="max-w-[140px] truncate text-xs text-zinc-500">{a.name}</span>
                  <button
                    type="button"
                    className="rounded-md p-1 text-zinc-500 hover:bg-red-500/15 hover:text-red-300"
                    onClick={() => removePendingAttachment(a.id)}
                    aria-label="Remove attachment"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              attachFile(e.target.files?.[0] ?? null);
              e.currentTarget.value = "";
            }}
          />
          <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised shadow-sm">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder="Message SolveGPT…"
              className="min-h-[52px] max-h-40 w-full resize-y border-0 bg-transparent px-4 py-3 text-[15px] leading-relaxed text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-0 disabled:opacity-50"
              disabled={streaming}
              aria-label="Message input"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-border px-2 py-2 sm:px-3">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-surface-hover hover:text-zinc-200"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach image"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                  <span className="hidden sm:inline">Add photos</span>
                </button>
                <button
                  type="button"
                  disabled={busy || !input.trim()}
                  onClick={() => void generateImage()}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-surface-hover hover:text-violet-200 disabled:opacity-40"
                  title="OpenAI DALL·E 3 — requires API key"
                  aria-label="Create image with DALL·E"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  <span className="hidden sm:inline">{imageBusy ? "Creating…" : "Image"}</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden text-[11px] text-zinc-600 sm:inline">Enter send · Shift+Enter new line</span>
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={streaming || (!input.trim() && !pendingAttachments.length)}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40"
                >
                  {streaming ? "…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </section>
  );
}
