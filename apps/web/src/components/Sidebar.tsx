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
    <aside className="flex w-full shrink-0 flex-col border-r border-surface-border bg-surface-raised md:w-72">
      <div className="flex flex-col gap-2 border-b border-surface-border p-3">
        <Link href="/" className="shrink-0 py-0.5 hover:opacity-90" title="Home">
          <CompanyLogo heightClass="h-7" />
        </Link>
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">History</span>
      </div>
      <div className="p-3">
        <button
          type="button"
          onClick={() => {
            resetChat();
            void load();
          }}
          className="w-full rounded-lg bg-accent py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          New chat
        </button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void load()}
          placeholder="Search titles…"
          className="mt-2 w-full rounded-md border border-surface-border bg-surface px-2 py-1.5 text-sm outline-none ring-accent focus:ring-1"
        />
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {items.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => void openConversation(c.id)}
            className={`mb-1 w-full rounded-md px-2 py-2 text-left text-sm ${
              c.id === conversationId ? "bg-surface text-white" : "text-zinc-400 hover:bg-surface"
            }`}
          >
            <div className="line-clamp-2 font-medium">{c.title}</div>
            <div className="mt-0.5 text-[10px] uppercase text-zinc-600">
              {c.provider} · {c.model}
            </div>
          </button>
        ))}
        {items.length === 0 && (
          <p className="px-2 text-sm text-zinc-600">No conversations yet. Start below.</p>
        )}
      </nav>
      <div className="border-t border-surface-border p-3 text-xs text-zinc-600">
        <Link href="/" className="text-accent hover:underline">
          Home
        </Link>
      </div>
    </aside>
  );
}
