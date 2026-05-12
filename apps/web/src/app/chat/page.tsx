"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { UserMenu } from "@/components/UserMenu";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useSession } from "@/lib/session-context";
import { Sidebar } from "@/components/Sidebar";
import { ChatMain } from "@/components/ChatMain";

export default function ChatPage() {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-accent" />
        <p className="mt-4 text-sm text-zinc-500">Loading workspace…</p>
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
        <Link href="/" className="flex shrink-0 items-center gap-3 py-0.5 transition hover:opacity-90">
          <CompanyLogo heightClass="h-8" />
          <div className="hidden border-l border-surface-border pl-3 sm:block">
            <span className="text-xs font-medium text-zinc-400">Workspace</span>
          </div>
        </Link>
        <div className="flex items-center gap-3 sm:gap-5">
          {user.role === "admin" && (
            <Link
              href="/admin"
              className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Admin
            </Link>
          )}
          <UserMenu />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <ChatMain />
      </div>
    </div>
  );
}
