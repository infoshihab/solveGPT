"use client";

import Link from "next/link";
import { useSession } from "@/lib/session-context";

export function UserMenu() {
  const { user, logout } = useSession();
  if (!user) return null;
  return (
    <div className="flex items-center gap-3 text-sm text-zinc-300">
      <span className="max-w-[180px] truncate text-xs text-zinc-400" title={user.email}>
        {user.email}
      </span>
      <button type="button" onClick={logout} className="text-accent hover:underline">
        Sign out
      </button>
      <Link href="/" className="text-zinc-500 hover:text-zinc-300">
        Account
      </Link>
    </div>
  );
}
