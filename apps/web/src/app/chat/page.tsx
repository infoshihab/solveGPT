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
      <div className="flex h-screen items-center justify-center bg-surface text-zinc-500">Loading…</div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface text-zinc-500">Redirecting…</div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-surface">
      <header className="flex shrink-0 items-center justify-between border-b border-surface-border px-4 py-2">
        <Link href="/" className="flex shrink-0 items-center gap-2 py-1 hover:opacity-90">
          <CompanyLogo heightClass="h-8" />
        </Link>
        <div className="flex items-center gap-4">
          {user.role === "admin" && (
            <Link href="/admin" className="text-sm text-accent hover:underline">
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
