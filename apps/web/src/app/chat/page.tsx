"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UserMenu } from "@/components/UserMenu";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useSession } from "@/lib/session-context";
import { Sidebar } from "@/components/Sidebar";
import { ChatMain } from "@/components/ChatMain";

export default function ChatPage() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-accent" />
        <p className="mt-4 text-sm text-zinc-500">Loading SolveGPT…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface text-sm text-zinc-500">Redirecting…</div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-surface text-zinc-100">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-surface-border bg-surface-raised/60 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border text-zinc-300 transition hover:text-white md:hidden"
            aria-label="Open chat history"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <Link href="/" className="flex shrink-0 items-center gap-3 py-0.5 transition hover:opacity-90">
            <CompanyLogo heightClass="h-8" />
            <div className="hidden border-l border-surface-border pl-3 sm:block">
              <span className="text-xs font-medium text-zinc-400">SolveGPT</span>
            </div>
          </Link>
          <nav className="hidden items-center gap-1.5 md:flex">
            <Link
              href="/"
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-surface-hover hover:text-zinc-200"
            >
              Home
            </Link>
            {user.role === "admin" && (
              <Link
                href="/admin"
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-surface-hover hover:text-zinc-200"
              >
                Dashboard
              </Link>
            )}
            <span className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500">Profile</span>
            <span className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500">Settings</span>
          </nav>
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
          {user.role === "admin" && (
            <Link
              href="/admin"
              className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white md:hidden"
            >
              Admin
            </Link>
          )}
          <div className="hidden text-xs text-zinc-500 sm:block">Signed in</div>
          <UserMenu />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1">
          <ChatMain />
        </div>
      </div>
    </div>
  );
}
