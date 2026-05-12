"use client";

import Link from "next/link";
import { useSession } from "@/lib/session-context";

export function UserMenu() {
  const { user, logout } = useSession();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span
        className="hidden max-w-[200px] truncate rounded-lg border border-surface-border bg-surface px-2.5 py-1 font-mono text-[11px] text-zinc-400 sm:inline-block"
        title={user.email}
      >
        {user.email}
      </span>
      <button
        type="button"
        onClick={logout}
        className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-200"
      >
        Sign out
      </button>
    </div>
  );
}
