"use client";

import { apiFetch } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

type Template = { id: string; name: string; content: string; isShared: boolean };

export function TemplatesPanel({ onInsert }: { onInsert: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  const load = useCallback(async () => {
    const res = await apiFetch("/api/templates");
    if (!res.ok) return;
    const data = (await res.json()) as { templates: Template[] };
    setItems(data.templates);
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const create = async () => {
    if (!name.trim() || !content.trim()) return;
    const res = await apiFetch("/api/templates", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), content: content.trim() }),
    });
    if (res.ok) {
      setName("");
      setContent("");
      void load();
    }
  };

  return (
    <div className="border-b border-surface-border bg-surface-raised/20 px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs font-semibold uppercase tracking-wide text-zinc-500 transition hover:text-zinc-300"
      >
        {open ? "▼ Hide prompt library" : "▶ Prompt templates"}
      </button>
      {open && (
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Saved prompts</p>
            <ul className="max-h-44 space-y-1.5 overflow-y-auto scrollbar-thin pr-1">
              {items.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm"
                >
                  <span className="truncate text-zinc-200">{t.name}</span>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-accent hover:underline"
                    onClick={() => onInsert(t.content)}
                  >
                    Insert
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Save new template</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="mb-2 w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-accent/25"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Prompt text…"
              rows={3}
              className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-accent/25"
            />
            <button
              type="button"
              onClick={() => void create()}
              className="mt-2 rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Save template
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
