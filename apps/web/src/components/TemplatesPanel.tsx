"use client";

import { apiFetch } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";

const EMBED_CREATE_VALUE = "__embed_create_template__";

type Template = { id: string; name: string; content: string; isShared: boolean };

type Props = {
  onInsert: (text: string) => void;
  /** Compact picker for the composer toolbar (dropdown; “Create templates” lives in the list). */
  embed?: boolean;
};

export function TemplatesPanel({ onInsert, embed }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [pick, setPick] = useState("");
  const [embedCreateOpen, setEmbedCreateOpen] = useState(false);
  const embedWrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/templates");
    if (!res.ok) return;
    const data = (await res.json()) as { templates: Template[] };
    setItems(data.templates);
  }, []);

  useEffect(() => {
    if (embed || open) void load();
  }, [embed, open, load]);

  const create = async () => {
    if (!name.trim() || !content.trim()) return;
    const res = await apiFetch("/api/templates", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), content: content.trim() }),
    });
    if (res.ok) {
      setName("");
      setContent("");
      if (embed) setEmbedCreateOpen(false);
      void load();
    }
  };

  useEffect(() => {
    if (!embed || !embedCreateOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEmbedCreateOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      const el = embedWrapRef.current;
      if (el && !el.contains(e.target as Node)) setEmbedCreateOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [embed, embedCreateOpen]);

  useEffect(() => {
    if (!embed || !embedCreateOpen) return;
    const t = window.setTimeout(() => {
      document.getElementById("embed-template-name")?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [embed, embedCreateOpen]);

  if (embed) {
    return (
      <div ref={embedWrapRef} className="relative z-50 w-full min-w-0 sm:w-auto">
        <label className="sr-only" htmlFor="template-insert">
          Prompt template
        </label>
        <div className="inline-flex min-h-9 w-full min-w-0 max-w-full items-stretch overflow-visible rounded-full border border-zinc-700/50 px-0.5 shadow-sm transition focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20 sm:inline-flex sm:max-w-[min(240px,40vw)]">
          <select
            id="template-insert"
            value={pick}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              if (id === EMBED_CREATE_VALUE) {
                setEmbedCreateOpen(true);
                setPick("");
                return;
              }
              const t = items.find((x) => x.id === id);
              if (t) onInsert(t.content);
              setPick("");
            }}
            className="composer-select composer-select--pill min-h-9 w-full min-w-0 rounded-full border-0 py-1.5 pl-3 text-sm"
            title="Insert a saved prompt or create a new template"
          >
            <option value="">Templates…</option>
            {items.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            {items.length > 0 ? (
              <option disabled value="__sep__">
                ────────────
              </option>
            ) : null}
            <option value={EMBED_CREATE_VALUE}>Create templates…</option>
          </select>
        </div>
        {embedCreateOpen && (
          <div
            className="absolute bottom-full left-0 z-40 mb-2 w-[min(100vw-2rem,320px)] overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-900 shadow-panel ring-1 ring-white/[0.06]"
            role="dialog"
            aria-label="Create prompt template"
          >
            <div className="border-b border-zinc-800/80 bg-gradient-to-r from-zinc-800/30 to-transparent px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">New template</p>
                <button
                  type="button"
                  onClick={() => setEmbedCreateOpen(false)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="p-3">
              <input
                id="embed-template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="mb-2 w-full rounded-lg border border-zinc-700/50 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/30"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Prompt text…"
                rows={3}
                className="w-full rounded-lg border border-zinc-700/50 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/30"
              />
              <button
                type="button"
                onClick={() => void create()}
                className="mt-3 w-full rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 py-2 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.1)_inset] ring-1 ring-blue-400/20 transition hover:from-blue-400 hover:to-blue-500"
              >
                Save template
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

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
