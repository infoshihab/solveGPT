"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MODELS, PROVIDERS, type ProviderId } from "@/lib/models";
import { apiFetch, getStoredToken, streamChat } from "@/lib/api";
import { useChatStore, type ChatMessage } from "@/store/chatStore";
import { TemplatesPanel } from "@/components/TemplatesPanel";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { wrapMarkdownImageUrl } from "@/lib/markdownImageUrl";

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-500">
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
    <div className="max-w-[min(42rem,92%)] rounded-xl border border-zinc-700/35 bg-zinc-800/55 px-4 py-2.5 shadow-sm">
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
          <p className="whitespace-pre-wrap break-words text-base leading-6 text-zinc-100">{message.content}</p>
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
          } else if (ev.type === "result" && ev.kind === "image") {
            addAssistantMessage(`![Generated image](${wrapMarkdownImageUrl(ev.data)})`);
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
      const img = body as { type?: string; data?: string; url?: string };
      const imageSrc = img.data ?? img.url;
      if (!imageSrc) throw new Error("No image URL in response");
      setInput("");
      if (conversationId) {
        await reloadConversation(conversationId);
      } else {
        addUserMessage(`Create image: ${prompt}`);
        addAssistantMessage(`![Generated](${wrapMarkdownImageUrl(imageSrc)})`);
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

  const busy = streaming || imageBusy;
  const last = messages[messages.length - 1];
  const showTyping = streaming && last?.role === "user";
  const showEmptyState = messages.length === 0;

  useEffect(() => {
    scrollChatToBottom();
  }, [messages, streaming, showTyping, scrollChatToBottom]);

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-surface">
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {showEmptyState && (
            <div className="rounded-xl border border-dashed border-zinc-700/50 bg-zinc-900/25 px-5 py-7 text-center">
              <p className="text-sm font-medium text-zinc-300">Start a new thread</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                Choose provider and model below, then type your message. With OpenAI, natural phrases like “create an
                image of…” can trigger image generation.
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
                  className={`max-w-[min(42rem,100%)] rounded-xl px-4 py-3 shadow-sm ${
                    m.role === "system"
                      ? "border border-amber-500/30 bg-amber-950/25 text-amber-50"
                      : "border border-zinc-800/60 bg-zinc-950/35"
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
              <div className="max-w-[min(42rem,100%)] rounded-xl border border-zinc-800/60 bg-zinc-950/35 px-4 py-2.5 shadow-sm">
                <TypingIndicator />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="border-t border-red-500/25 bg-red-950/40 px-4 py-2.5 text-sm text-red-100">{error}</div>
      )}

      <footer className="shrink-0 border-t border-zinc-800/60 bg-zinc-950/90 px-4 py-3 md:px-6 md:py-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2.5">
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingAttachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/60 px-2 py-1.5 pr-1"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.dataUrl} alt="" className="h-9 w-9 rounded-md object-cover ring-1 ring-zinc-800" />
                  <span className="max-w-[140px] truncate text-xs text-zinc-400">{a.name}</span>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-red-500/15 hover:text-red-300"
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
          {/* Composer: standard message field, then options strip (standard control heights) */}
          <div className="overflow-visible rounded-xl border border-zinc-800/60 bg-zinc-900/75 shadow-md ring-1 ring-black/25">
            <label htmlFor="composer-message" className="sr-only">
              Message
            </label>
            <div className="p-3 md:p-3.5">
              <textarea
                id="composer-message"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={3}
                placeholder="Message"
                className="max-h-[min(28vh,11rem)] min-h-[5.25rem] w-full resize-y rounded-lg border border-zinc-800/70 bg-zinc-950 px-3 py-2.5 text-sm leading-6 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-150 placeholder:text-zinc-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-45"
                disabled={streaming}
                aria-label="Message input"
              />
            </div>

            <div className="border-t border-zinc-800/60 bg-zinc-950/40 px-3 py-2 md:px-3.5 md:py-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex min-h-9 min-w-0 max-w-[min(128px,40vw)] shrink-0 items-center overflow-visible rounded-full border border-zinc-700/50 px-0.5 shadow-sm transition focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20">
                  <label className="sr-only" htmlFor="composer-provider">
                    Provider
                  </label>
                  <select
                    id="composer-provider"
                    value={provider}
                    disabled={busy}
                    onChange={(e) => setProvider(e.target.value as ProviderId)}
                    className="composer-select composer-select--pill min-h-9 w-full rounded-full border-0 py-1.5 pl-3 text-sm font-medium"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="inline-flex min-h-9 min-w-0 max-w-[min(200px,52vw)] flex-1 items-center overflow-visible rounded-full border border-zinc-700/50 px-0.5 shadow-sm transition focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20 sm:max-w-[min(240px,42%)]">
                  <label className="sr-only" htmlFor="composer-model">
                    Model
                  </label>
                  <select
                    id="composer-model"
                    value={model}
                    disabled={busy}
                    onChange={(e) => setModel(e.target.value)}
                    className="composer-select composer-select--pill min-h-9 w-full rounded-full border-0 py-1.5 pl-3 text-sm"
                  >
                    {modelOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 flex-1 basis-full sm:basis-auto sm:flex-initial">
                  <TemplatesPanel
                    embed
                    onInsert={(text) => setInput((prev) => (prev ? `${prev}\n\n${text}` : text))}
                  />
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-blue-500/40"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach image"
                    title="Attach images"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    disabled={busy || !input.trim()}
                    onClick={() => void generateImage()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-800 hover:text-violet-300 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-violet-500/40 disabled:pointer-events-none disabled:opacity-35"
                    title="Generate image (OpenAI)"
                    aria-label="Generate image"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={streaming || (!input.trim() && !pendingAttachments.length)}
                    className="ml-1 h-9 min-w-[5.25rem] shrink-0 rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-blue-400/30 transition hover:from-blue-400 hover:to-blue-600 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                  >
                    {streaming ? "…" : "Send"}
                  </button>
                </div>
              </div>
              <div
                className={
                  usage
                    ? "mt-1.5 flex flex-wrap items-center gap-2 border-t border-zinc-800/40 pt-1.5 sm:border-0 sm:pt-0"
                    : "mt-1.5 hidden flex-wrap items-center gap-2 sm:flex sm:justify-end"
                }
              >
                {usage ? (
                  <span className="min-w-0 max-w-[min(100%,20rem)] flex-1 truncate rounded-md border border-emerald-500/20 bg-emerald-950/30 px-2 py-1 text-[11px] font-medium leading-tight text-emerald-100/95">
                    {usage}
                  </span>
                ) : null}
                <span className="ml-auto shrink-0 text-[11px] tabular-nums text-zinc-500">
                  Enter to send · Shift+Enter new line
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </section>
  );
}
