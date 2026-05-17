"use client";

import { useSession } from "@/lib/session-context";

function getInitials(email: string): string {
  const local = email.split("@")[0];
  const parts = local.split(/[._\-+]/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

function SignOutIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}

export function UserMenu() {
  const { user, logout } = useSession();
  if (!user) return null;

  const initials = getInitials(user.email);

  return (
    <div className="flex items-center gap-2">
      {/* Email — large screens */}
      <span
        className="hidden max-w-[180px] truncate text-xs text-zinc-500 xl:block"
        title={user.email}
      >
        {user.email}
      </span>

      {/* Divider */}
      <div className="hidden h-4 w-px bg-white/[0.1] xl:block" aria-hidden />

      {/* Sign out — desktop */}
      <button
        type="button"
        onClick={logout}
        className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 sm:inline-flex"
      >
        <SignOutIcon />
        Sign out
      </button>

      {/* Avatar — always visible, tapping signs out on mobile */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white ring-1 ring-white/[0.12]"
        title={user.email}
        aria-hidden
      >
        {initials}
      </div>
    </div>
  );
}
