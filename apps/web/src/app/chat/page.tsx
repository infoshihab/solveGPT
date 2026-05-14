"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppNavbar } from "@/components/AppNavbar";
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
      <AppNavbar onOpenSidebar={() => setSidebarOpen(true)} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1">
          <ChatMain />
        </div>
      </div>
    </div>
  );
}
