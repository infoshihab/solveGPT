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
        className="hidden min-w-0 items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] py-1 pl-1 pr-3 sm:flex"
        title={user.email}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-xs font-semibold text-zinc-100 ring-1 ring-white/[0.06]"
          aria-hidden
        >
          {initialFromEmail(user.email)}
        </span>
        <span className="max-w-[180px] truncate text-left text-xs font-medium text-zinc-300 lg:max-w-[220px]">
          {user.email}
        </span>
      </div>
      <button type="button" onClick={logout} className="ui-btn-secondary px-3 py-2 text-xs font-semibold">
        Sign out
      </button>
    </div>
  );
}
