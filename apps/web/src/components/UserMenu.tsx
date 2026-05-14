"use client";

import { useSession } from "@/lib/session-context";

function initialFromEmail(email: string) {
  const c = email.trim().charAt(0);
  return c ? c.toUpperCase() : "?";
}

export function UserMenu() {
  const { user, logout } = useSession();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div
        className="hidden min-w-0 items-center gap-2.5 rounded-lg border border-surface-border bg-surface/80 py-1 pl-1 pr-3 sm:flex"
        title={user.email}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-700/80 text-xs font-semibold text-zinc-100"
          aria-hidden
        >
          {initialFromEmail(user.email)}
        </span>
        <span className="max-w-[180px] truncate text-left text-xs font-medium text-zinc-300 lg:max-w-[220px]">
          {user.email}
        </span>
      </div>
      <button
        type="button"
        onClick={logout}
        className="rounded-md border border-surface-border bg-transparent px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:bg-surface-hover hover:text-white"
      >
        Sign out
      </button>
    </div>
  );
}
