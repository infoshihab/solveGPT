"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { UserMenu } from "@/components/UserMenu";
import { useSession } from "@/lib/session-context";

function SidebarIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
    </svg>
  );
}

type NavItem = { href: string; label: string; match: (path: string) => boolean };

export function AppNavbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user } = useSession();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!user) return null;

  const navItems: NavItem[] = [
    { href: "/chat", label: "Chat", match: (p) => p === "/chat" || p.startsWith("/chat/") },
  ];
  if (user.role === "admin") {
    navItems.push({
      href: "/admin",
      label: "Admin",
      match: (p) => p === "/admin" || p.startsWith("/admin/"),
    });
  }

  const onChat = pathname === "/chat" || pathname.startsWith("/chat/");

  return (
    <header className="sticky top-0 z-40 shrink-0">
      {/* ── Top bar ── */}
      <div className="border-b border-white/[0.07] bg-[#0c0c0c]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          {/* Left — sidebar toggle (mobile) + brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 md:hidden"
              aria-label="Open conversation history"
              onClick={onOpenSidebar}
            >
              <SidebarIcon />
            </button>

            <Link
              href="/chat"
              className="flex items-center gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/25"
              onClick={() => setMobileNavOpen(false)}
            >
              <span className="relative flex h-8 w-20 shrink-0 items-center">
                <CompanyLogo heightClass="h-8" className="block w-full" />
              </span>
              <span className="hidden text-base font-bold leading-none tracking-tight text-white sm:block">
                SolveGPT
              </span>
            </Link>
          </div>

          {/* Center — desktop nav */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {navItems.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "relative rounded-md px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "text-white after:absolute after:inset-x-3 after:-bottom-px after:h-px after:bg-white/50"
                      : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right — CTA + user menu + mobile menu toggle */}
          <div className="flex shrink-0 items-center gap-3">
            {!onChat && (
              <Link
                href="/chat"
                className="hidden items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-100 sm:inline-flex"
              >
                <ChatBubbleIcon />
                New Chat
              </Link>
            )}

            <UserMenu />

            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 md:hidden"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              {mobileNavOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile nav panel ── */}
      {mobileNavOpen && (
        <div className="border-b border-white/[0.07] bg-[#0c0c0c]/95 backdrop-blur-xl md:hidden">
          <nav
            className="mx-auto max-w-7xl px-4 py-3 sm:px-6"
            aria-label="Mobile navigation"
          >
            <ul className="flex flex-col gap-0.5">
              {navItems.map((item) => {
                const active = item.match(pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={[
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-white/[0.08] text-white"
                          : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200",
                      ].join(" ")}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      {active && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" aria-hidden />
                      )}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {!onChat && (
              <Link
                href="/chat"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-100"
                onClick={() => setMobileNavOpen(false)}
              >
                <ChatBubbleIcon />
                New Chat
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
