"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompanyLogo } from "@/components/CompanyLogo";
import { UserMenu } from "@/components/UserMenu";
import { useSession } from "@/lib/session-context";

function MenuIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function AppNavbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user } = useSession();
  const pathname = usePathname();

  if (!user) return null;

  const linkBase =
    "relative inline-flex items-center rounded-lg px-3 py-2 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  const linkInactive = "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100";
  const linkActive =
    "bg-white/[0.06] text-white ring-1 ring-inset ring-white/[0.06] shadow-[inset_0_-2px_0_0_theme(colors.accent.DEFAULT)]";

  return (
    <header className="shrink-0 border-b border-white/[0.06] bg-zinc-950/80 shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-4 px-4 py-2.5 sm:px-5 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <button
            type="button"
            className="ui-btn-ghost h-9 w-9 shrink-0 md:hidden"
            aria-label="Open chat history"
            onClick={onOpenSidebar}
          >
            <MenuIcon />
          </button>

          <Link
            href="/chat"
            className="flex shrink-0 items-center gap-3 rounded-lg py-0.5 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <CompanyLogo heightClass="h-10 sm:h-11 md:h-12" innerZoom={1.14} />
            <div className="hidden h-10 w-px shrink-0 bg-white/[0.08] sm:block sm:h-11 md:h-12" aria-hidden />
            <div className="hidden min-w-0 flex-col sm:flex">
              <span className="truncate text-sm font-semibold tracking-tight text-white">SolveGPT</span>
              <span className="truncate text-[11px] font-medium text-zinc-500">Workspace</span>
            </div>
          </Link>

          <nav
            className="ml-1 hidden items-center gap-0.5 border-l border-white/[0.08] pl-4 md:flex"
            aria-label="Main"
          >
            <Link href="/" className={`${linkBase} text-sm ${pathname === "/" ? linkActive : linkInactive}`}>
              Home
            </Link>
            <Link
              href="/chat"
              className={`${linkBase} text-sm ${
                pathname === "/chat" || pathname.startsWith("/chat/") ? linkActive : linkInactive
              }`}
              aria-current={pathname === "/chat" || pathname.startsWith("/chat/") ? "page" : undefined}
            >
              Chat
            </Link>
            {user.role === "admin" && (
              <Link
                href="/admin"
                className={`${linkBase} text-sm ${
                  pathname === "/admin" || pathname.startsWith("/admin/") ? linkActive : linkInactive
                }`}
                aria-current={
                  pathname === "/admin" || pathname.startsWith("/admin/") ? "page" : undefined
                }
              >
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 md:hidden">
            <Link href="/" className={`${linkBase} text-xs ${pathname === "/" ? linkActive : linkInactive}`}>
              Home
            </Link>
            <Link
              href="/chat"
              className={`${linkBase} text-xs ${
                pathname === "/chat" || pathname.startsWith("/chat/") ? linkActive : linkInactive
              }`}
              aria-current={pathname === "/chat" || pathname.startsWith("/chat/") ? "page" : undefined}
            >
              Chat
            </Link>
            {user.role === "admin" && (
              <Link
                href="/admin"
                className={`${linkBase} text-xs ${
                  pathname === "/admin" || pathname.startsWith("/admin/") ? linkActive : linkInactive
                }`}
                aria-current={
                  pathname === "/admin" || pathname.startsWith("/admin/") ? "page" : undefined
                }
              >
                Admin
              </Link>
            )}
          </div>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
