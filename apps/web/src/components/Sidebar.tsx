"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useChatStore } from "@/store/chatStore";
import { CompanyLogo } from "@/components/CompanyLogo";

type Conv = {
  id: string;
  title: string;
  provider: string;
  model: string;
  updatedAt: string;
};

type SidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const [items, setItems] = useState<Conv[]>([]);
  const [q, setQ] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const conversationId = useChatStore((s) => s.conversationId);
  const resetChat = useChatStore((s) => s.resetChat);
  const setConversationId = useChatStore((s) => s.setConversationId);
  const setMessages = useChatStore((s) => s.setMessages);
  const setProvider = useChatStore((s) => s.setProvider);
  const setModel = useChatStore((s) => s.setModel);

  const load = useCallback(async () => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    const res = await apiFetch(`/api/chat/conversations${qs}`);
    if (!res.ok) return;
    const data = (await res.json()) as { conversations: Conv[] };
    setItems(data.conversations);
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const openConversation = async (id: string) => {
    const res = await apiFetch(`/api/chat/conversations/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      conversation: Conv;
      messages: { role: string; content: string }[];
    };
    setConversationId(data.conversation.id);
    setProvider(data.conversation.provider as never);
    setModel(data.conversation.model);
    setMessages(
      data.messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }))
    );
    onClose();
  };

  const deleteConversation = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      setItems((prev) => prev.filter((x) => x.id !== id));
      if (conversationId === id) resetChat();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-20 bg-black/50 transition md:hidden ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-80 max-w-[88vw] shrink-0 flex-col border-r border-surface-border bg-surface-raised/95 backdrop-blur transition-transform md:static md:z-0 md:w-72 md:max-w-none md:translate-x-0 md:bg-surface-raised/40 md:backdrop-blur-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Conversation history"
      >
      <div className="border-b border-surface-border p-4">
        <Link href="/" className="inline-block py-0.5 opacity-90 transition hover:opacity-100" title="Home">
          <CompanyLogo heightClass="h-7" />
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Conversations</p>
          <button
            type="button"
            className="rounded-lg border border-surface-border px-2 py-1 text-[11px] text-zinc-400 transition hover:text-zinc-200 md:hidden"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
      <div className="border-b border-surface-border p-3">
        <button
          type="button"
          onClick={() => {
            resetChat();
            void load();
            onClose();
          }}
          className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-900/20 transition hover:bg-blue-500"
        >
          New chat
        </button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void load()}
          placeholder="Search…"
          className="mt-2 w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm text-zinc-200 outline-none ring-1 ring-transparent transition placeholder:text-zinc-600 focus:border-accent/30 focus:ring-accent/20"
        />
      </div>
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2 pb-6">
        {items.map((c) => (
          <div
            key={c.id}
            className={`mb-1 flex items-stretch gap-1 rounded-xl border transition ${
              c.id === conversationId
                ? "border-accent/40 bg-accent/10 shadow-sm"
                : "border-transparent hover:border-surface-border hover:bg-surface-hover"
            }`}
          >
            <button
              type="button"
              onClick={() => void openConversation(c.id)}
              className={`min-w-0 flex-1 rounded-l-xl px-3 py-2.5 text-left text-sm transition ${
                c.id === conversationId ? "text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <div className="line-clamp-2 font-medium leading-snug">{c.title}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-zinc-600">
                {c.provider} · {c.model}
              </div>
            </button>
            <button
              type="button"
              disabled={deletingId === c.id}
              onClick={(e) => void deleteConversation(e, c.id)}
              className="flex shrink-0 items-center justify-center rounded-r-xl border-l border-surface-border/80 px-2.5 text-zinc-500 transition hover:bg-red-500/15 hover:text-red-300 disabled:opacity-40"
              aria-label={`Delete conversation: ${c.title}`}
              title="Delete conversation"
            >
              {deletingId === c.id ? (
                <span className="text-xs">…</span>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" x2="10" y1="11" y2="17" />
                  <line x1="14" x2="14" y1="11" y2="17" />
                </svg>
              )}
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="px-2 py-6 text-center text-sm text-zinc-600">No history yet.</p>}
      </nav>
      <div className="mt-auto border-t border-surface-border p-3">
        <Link
          href="/"
          className="text-xs font-medium text-zinc-500 transition hover:text-accent"
        >
          ← Home
        </Link>
      </div>
      </aside>
    </>
  );
}
