"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MODELS, PROVIDERS, type ProviderId } from "@/lib/models";
import { apiFetch, getStoredToken, streamChat } from "@/lib/api";
import { useChatStore, type ChatMessage } from "@/store/chatStore";
import { TemplatesPanel } from "@/components/TemplatesPanel";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { wrapMarkdownImageUrl } from "@/lib/markdownImageUrl";

// ── Provider config ─────────────────────────────────────────────────────────

const PROVIDER_STYLES: Record<string, { bg: string; text: string; initials: string; label: string }> = {
  anthropic: { bg: "bg-[#CC785C]",  text: "text-white",     initials: "Cl", label: "Claude"   },
  openai:    { bg: "bg-[#10A37F]",  text: "text-white",     initials: "GP", label: "ChatGPT"  },
  grok:      { bg: "bg-zinc-200",   text: "text-zinc-900",  initials: "Gr", label: "Grok"     },
  gemini:    { bg: "bg-[#4285F4]",  text: "text-white",     initials: "Ge", label: "Gemini"   },
};
const FALLBACK_STYLE = { bg: "bg-zinc-700", text: "text-zinc-200", initials: "AI", label: "AI" };

function ProviderAvatar({ provider, size = "sm" }: { provider?: ProviderId; size?: "sm" | "md" }) {
  const s = provider ? (PROVIDER_STYLES[provider] ?? FALLBACK_STYLE) : FALLBACK_STYLE;
  const dim = size === "md" ? "h-8 w-8 text-[11px]" : "h-6 w-6 text-[10px]";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${dim} ${s.bg} ${s.text}`}
      aria-hidden
    >
      {s.initials}
    </div>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────

function AttachIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

// ── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ provider }: { provider?: ProviderId }) {
  const s = provider ? (PROVIDER_STYLES[provider] ?? FALLBACK_STYLE) : FALLBACK_STYLE;
  return (
    <div className="flex items-start gap-3 py-1">
      <ProviderAvatar provider={provider} size="md" />
      <div className="flex items-center gap-2 pt-1">
        <span className="text-sm text-zinc-500">{s.label} is thinking</span>
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-zinc-600"
              style={{ animation: "typing-dot 1.2s ease-in-out infinite", animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

// ── User bubble ───────────────────────────────────────────────────────────────

function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[min(36rem,88%)]">
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap justify-end gap-2">
            {message.attachments.map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={a.id}
                src={a.dataUrl}
                alt={a.name}
                className="max-h-52 max-w-full rounded-2xl border border-white/[0.08] object-cover shadow-sm"
              />
            ))}
          </div>
        )}
        {message.content.trim() && (
          <div className="rounded-2xl bg-zinc-800 px-4 py-3 shadow-sm">
            {/!\[[^\]]*\]\([^)]+\)/.test(message.content) ||
            /^#{1,6}\s/m.test(message.content) ||
            message.content.includes("```") ? (
              <MarkdownMessage content={message.content} />
            ) : (
              <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-zinc-100">
                {message.content}
              </p>
            )}
          </div>
        )}
        {!message.content.trim() && message.attachments?.length && (
          <div className="rounded-2xl bg-zinc-800 px-4 py-3">
            <p className="text-sm text-zinc-400">Photo attached</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Assistant message ─────────────────────────────────────────────────────────

function AssistantMessage({ message, isStreaming }: { message: ChatMessage; isStreaming: boolean }) {
  const s = message.provider ? (PROVIDER_STYLES[message.provider] ?? FALLBACK_STYLE) : FALLBACK_STYLE;
  return (
    <div className="flex items-start gap-3">
      <ProviderAvatar provider={message.provider} size="md" />
      <div className="min-w-0 flex-1 pb-1">
        <p className="mb-2 text-[13px] font-medium text-zinc-500">{s.label}</p>
        <div className="prose-invert">
          <MarkdownMessage content={message.content} />
          {isStreaming && (
            <span
              className="ml-0.5 inline-block h-[1.1em] w-0.5 animate-pulse rounded-sm bg-zinc-400 align-text-bottom"
              aria-hidden
            />
          )}
        </div>
        {message.model && !isStreaming && (
          <p className="mt-3 text-[11px] text-zinc-600">{message.model}</p>
        )}
      </div>
    </div>
  );
}

// ── System message ────────────────────────────────────────────────────────────

function SystemMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-amber-300/60">
        System Prompt
      </p>
      <MarkdownMessage content={message.content} />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Write a professional email to my team",
  "Explain quantum computing simply",
  "Generate an image of a mountain sunrise",
  "Review and improve my code",
];

function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center px-4 pt-16 pb-8 text-center">
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 ring-1 ring-white/[0.08]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-400" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      </div>
      <h2 className="mb-1.5 text-xl font-semibold text-white">How can I help you?</h2>
      <p className="mb-8 text-sm text-zinc-500">Ask a question, get help with code, or generate an image.</p>
      <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestion(s)}
            className="rounded-xl border border-white/[0.07] bg-zinc-900/70 px-4 py-3 text-left text-sm text-zinc-300 transition hover:border-white/[0.14] hover:bg-zinc-800/80 hover:text-white active:scale-[0.98]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [input]);

  const scrollChatToBottom = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, []);

  const modelOptions = useMemo(() => MODELS[provider], [provider]);

  useEffect(() => {
    if (!modelOptions.some((m) => m.id === model)) {
      const fallback = modelOptions[0]?.id;
      if (fallback) setModel(fallback);
    }
  }, [model, modelOptions, setModel]);

  const reloadConversation = useCallback(
    async (id: string) => {
      const res = await apiFetch(`/api/chat/conversations/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as { messages: { role: string; content: string }[] };
      setMessages(data.messages.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })));
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
    if (!getStoredToken()) { setError("Not signed in"); setStreaming(false); return; }
    const payloadMessages = useChatStore.getState().messages.map(({ role, content }) => ({ role, content }));
    try {
      await streamChat(
        {
          conversationId: conversationId ?? undefined,
          provider,
          model,
          messages: payloadMessages,
          attachments: snap.length ? snap.map(({ name, mime, dataUrl }) => ({ name, mime, dataUrl })) : undefined,
        },
        (ev) => {
          if (ev.type === "meta") {
            setConversationId(ev.conversationId);
          } else if (ev.type === "token") {
            appendAssistantChunk(ev.text, provider, model);
          } else if (ev.type === "result" && ev.kind === "image") {
            addAssistantMessage(`![Generated image](${wrapMarkdownImageUrl(ev.data)})`, provider, model);
          } else if (ev.type === "done") {
            setUsage(`${ev.usage.inputTokens} in · ${ev.usage.outputTokens} out · $${ev.usage.costUsd.toFixed(4)}`);
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
      if (!prompt) setError("Describe the image, then click the image button.");
      return;
    }
    setError(null);
    setImageBusy(true);
    if (!getStoredToken()) { setError("Not signed in"); setImageBusy(false); return; }
    try {
      const res = await apiFetch("/api/chat/generate-image", {
        method: "POST",
        body: JSON.stringify({ prompt, conversationId: conversationId ?? undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Image generation failed");
      const img = body as { type?: string; data?: string; url?: string };
      const imageSrc = img.data ?? img.url;
      if (!imageSrc) throw new Error("No image in response");
      setInput("");
      if (conversationId) {
        await reloadConversation(conversationId);
      } else {
        addUserMessage(`Create image: ${prompt}`);
        addAssistantMessage(`![Generated](${wrapMarkdownImageUrl(imageSrc)})`, provider, model);
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
      if (file.size > 10 * 1024 * 1024) { setError("Each image must be under 10 MB."); return; }
      setError(null);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? "");
        const id = typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
        addPendingAttachment({ id, name: file.name || "image", mime: file.type, dataUrl });
      };
      reader.readAsDataURL(file);
    },
    [addPendingAttachment]
  );

  const busy = streaming || imageBusy;
  const last = messages[messages.length - 1];
  const showTyping = streaming && last?.role === "user";
  const showEmptyState = messages.length === 0;
  const canSend = !streaming && (input.trim().length > 0 || pendingAttachments.length > 0);

  useEffect(() => { scrollChatToBottom(); }, [messages, streaming, showTyping, scrollChatToBottom]);

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-surface">

      {/* ── Message list ── */}
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto scroll-smooth">
        <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-6 md:px-6">

          {showEmptyState ? (
            <EmptyState onSuggestion={(s) => { setInput(s); textareaRef.current?.focus(); }} />
          ) : (
            <div className="space-y-6">
              {messages.map((m, i) => {
                const isLastAssistant = streaming && i === messages.length - 1 && m.role === "assistant";
                if (m.role === "user") return <UserBubble key={`msg-${i}`} message={m} />;
                if (m.role === "system") return (
                  <div key={`msg-${i}`} className="w-full">
                    <SystemMessage message={m} />
                  </div>
                );
                return (
                  <div key={`msg-${i}`} className="w-full">
                    <AssistantMessage message={m} isStreaming={isLastAssistant} />
                  </div>
                );
              })}
              {showTyping && <TypingIndicator provider={provider} />}
            </div>
          )}
        </div>
      </div>

      {/* ── Composer area ── */}
      <footer className="shrink-0 px-4 pb-5 pt-3 md:px-6 md:pb-6">
        <div className="mx-auto w-full max-w-3xl">

          {/* Error strip */}
          {error && (
            <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-red-500/20 bg-red-950/30 px-4 py-3 text-sm text-red-200">
              <span className="min-w-0 flex-1">{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="shrink-0 rounded-md p-0.5 text-red-300/60 hover:text-red-200"
                aria-label="Dismiss error"
              >
                <CloseIcon />
              </button>
            </div>
          )}

          {/* Pending attachments */}
          {pendingAttachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingAttachments.map((a) => (
                <div
                  key={a.id}
                  className="group relative flex items-center gap-2 rounded-xl border border-white/[0.07] bg-zinc-900 pl-1.5 pr-2 py-1.5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.dataUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  <span className="max-w-[120px] truncate text-xs text-zinc-400">{a.name}</span>
                  <button
                    type="button"
                    onClick={() => removePendingAttachment(a.id)}
                    className="ml-1 rounded-full p-1 text-zinc-600 transition hover:bg-red-500/15 hover:text-red-300"
                    aria-label="Remove"
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Composer card */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-zinc-900/90 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_8px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-shadow focus-within:border-white/[0.14] focus-within:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_40px_rgba(0,0,0,0.5)]">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { attachFile(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }}
            />

            {/* Textarea */}
            <label htmlFor="composer-message" className="sr-only">Message</label>
            <textarea
              ref={textareaRef}
              id="composer-message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
              }}
              rows={1}
              placeholder="Message…"
              disabled={streaming}
              className="block w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[15px] leading-7 text-zinc-100 outline-none placeholder:text-zinc-500 disabled:opacity-50"
              style={{ minHeight: "3.5rem", maxHeight: "13.75rem" }}
              aria-label="Message input"
            />

            {/* Bottom controls */}
            <div className="flex items-center gap-1 px-3 pb-3 pt-1">

              {/* Left — attach + image gen */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-300"
                aria-label="Attach image"
                title="Attach image"
              >
                <AttachIcon />
              </button>
              <button
                type="button"
                disabled={busy || !input.trim()}
                onClick={() => void generateImage()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-violet-300 disabled:pointer-events-none disabled:opacity-30"
                title="Generate image"
                aria-label="Generate image"
              >
                <ImageIcon />
              </button>

              {/* Templates */}
              <div className="hidden sm:block">
                <TemplatesPanel
                  embed
                  onInsert={(text) => setInput((prev) => (prev ? `${prev}\n\n${text}` : text))}
                />
              </div>

              {/* Divider */}
              <div className="mx-1 h-4 w-px bg-white/[0.08]" />

              {/* Provider selector */}
              <div className="flex min-h-8 min-w-0 items-center rounded-lg border border-white/[0.07] bg-black/20 px-0.5 transition focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/20">
                <label className="sr-only" htmlFor="composer-provider">Provider</label>
                <select
                  id="composer-provider"
                  value={provider}
                  disabled={busy}
                  onChange={(e) => setProvider(e.target.value as ProviderId)}
                  className="composer-select h-7 rounded-lg border-0 bg-transparent py-0 pl-2.5 pr-6 text-xs font-medium text-zinc-300 outline-none"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Model selector */}
              <div className="flex min-h-8 min-w-0 max-w-[min(180px,40vw)] flex-1 items-center rounded-lg border border-white/[0.07] bg-black/20 px-0.5 transition focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/20">
                <label className="sr-only" htmlFor="composer-model">Model</label>
                <select
                  id="composer-model"
                  value={model}
                  disabled={busy}
                  onChange={(e) => setModel(e.target.value)}
                  className="composer-select h-7 w-full rounded-lg border-0 bg-transparent py-0 pl-2.5 pr-6 text-xs text-zinc-300 outline-none"
                >
                  {modelOptions.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Send button */}
              <button
                type="button"
                onClick={() => void send()}
                disabled={!canSend}
                className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white shadow-sm transition hover:bg-blue-500 active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                aria-label="Send message"
              >
                {streaming ? (
                  <span className="h-3 w-3 animate-pulse rounded-sm bg-white" />
                ) : (
                  <SendIcon />
                )}
              </button>
            </div>
          </div>

          {/* Usage + keyboard hint */}
          <div className="mt-2 flex items-center gap-3 px-1">
            {usage ? (
              <span className="text-[11px] tabular-nums text-zinc-600">{usage}</span>
            ) : null}
            <span className="ml-auto text-[11px] text-zinc-700">Enter ↵ to send · Shift+Enter for new line</span>
          </div>
        </div>
      </footer>
    </section>
  );
}
