"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

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
    <div className="border-b border-surface-border px-4 py-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs font-medium uppercase tracking-wide text-zinc-400 hover:text-white"
      >
        {open ? "Hide templates" : "Prompt templates"}
      </button>
      {open && (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-zinc-500">Library</p>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {items.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded bg-surface-raised px-2 py-1">
                  <span className="truncate text-zinc-200">{t.name}</span>
                  <button
                    type="button"
                    className="shrink-0 text-accent hover:underline"
                    onClick={() => onInsert(t.content)}
                  >
                    Use
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs text-zinc-500">Save personal template</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="mb-1 w-full rounded border border-surface-border bg-surface-raised px-2 py-1 text-sm"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Prompt text"
              rows={3}
              className="w-full rounded border border-surface-border bg-surface-raised px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => void create()}
              className="mt-1 rounded bg-zinc-700 px-3 py-1 text-xs text-white hover:bg-zinc-600"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
