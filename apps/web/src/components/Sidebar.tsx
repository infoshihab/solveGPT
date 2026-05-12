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

export function Sidebar() {
  const [items, setItems] = useState<Conv[]>([]);
  const [q, setQ] = useState("");
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
  };

  return (
    <aside className="flex w-full shrink-0 flex-col border-r border-surface-border bg-surface-raised/40 md:w-72">
      <div className="border-b border-surface-border p-4">
        <Link href="/" className="inline-block py-0.5 opacity-90 transition hover:opacity-100" title="Home">
          <CompanyLogo heightClass="h-7" />
        </Link>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Conversations</p>
      </div>
      <div className="border-b border-surface-border p-3">
        <button
          type="button"
          onClick={() => {
            resetChat();
            void load();
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
          <button
            key={c.id}
            type="button"
            onClick={() => void openConversation(c.id)}
            className={`mb-1 w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${
              c.id === conversationId
                ? "border-accent/40 bg-accent/10 text-white shadow-sm"
                : "border-transparent text-zinc-400 hover:border-surface-border hover:bg-surface-hover hover:text-zinc-200"
            }`}
          >
            <div className="line-clamp-2 font-medium leading-snug">{c.title}</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-zinc-600">
              {c.provider} · {c.model}
            </div>
          </button>
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
  );
}
