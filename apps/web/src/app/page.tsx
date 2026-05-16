"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useSession } from "@/lib/session-context";

export default function HomePage() {
  const { user, loading, bootError, login, refresh } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/chat");
  }, [loading, user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await login(email, password);
      router.replace("/chat");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-700 border-t-accent" />
        <p className="mt-4 text-sm text-zinc-500">Checking session…</p>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-surface px-4 py-16">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -15%, rgba(59, 130, 246, 0.12), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(99, 102, 241, 0.08), transparent 50%)",
        }}
      />
      <div className="relative w-full max-w-[420px] space-y-10">
        <div className="text-center">
          <CompanyLogo heightClass="h-11 sm:h-12" priority className="mx-auto" />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-white">SolveGPT</h1>
          <p className="mt-2 text-sm text-zinc-500">Sign in to continue</p>
        </div>

        <form onSubmit={(e) => void submit(e)} className="ui-card space-y-6 p-8 shadow-float ring-1 ring-black/40">
          {bootError && (
            <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-center text-sm text-amber-100">
              <p>{bootError}</p>
              <button
                type="button"
                className="text-xs font-semibold text-accent hover:underline"
                onClick={() => void refresh()}
              >
                Retry connection
              </button>
            </div>
          )}
          {err && (
            <p className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2.5 text-center text-sm text-red-200">
              {err}
            </p>
          )}

          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-zinc-500">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="ui-field"
                placeholder="you@company.com"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-zinc-500">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ui-field"
                placeholder="••••••••"
                required
              />
            </label>
            <button type="submit" className="ui-btn-primary w-full py-3 text-[15px]">
              Continue
            </button>
          </div>
        </form>

        <p className="text-center text-xs leading-relaxed text-zinc-600">
          Need an account? Your administrator can create one.
        </p>
      </div>
    </div>
  );
}
