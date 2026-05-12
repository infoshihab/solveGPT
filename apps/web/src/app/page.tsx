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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-accent" />
        <p className="mt-4 text-sm text-zinc-500">Checking session…</p>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-surface px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(37, 99, 235, 0.25), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(99, 102, 241, 0.12), transparent)",
        }}
      />
      <div className="relative w-full max-w-[400px] space-y-8">
        <div className="text-center">
          <CompanyLogo heightClass="h-12" priority className="mx-auto" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-white">SolveGPT</h1>
          <p className="mt-2 text-sm text-zinc-500">Sign in to your workspace</p>
        </div>

        <form
          onSubmit={(e) => void submit(e)}
          className="rounded-2xl border border-surface-border bg-surface-raised/80 p-8 shadow-panel backdrop-blur-sm"
        >
          {bootError && (
            <div className="mb-6 space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
              <p>{bootError}</p>
              <button
                type="button"
                className="text-xs font-medium text-accent hover:underline"
                onClick={() => void refresh()}
              >
                Retry connection
              </button>
            </div>
          )}
          {err && (
            <p className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">
              {err}
            </p>
          )}

          <div className="space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-white outline-none ring-1 ring-transparent transition placeholder:text-zinc-600 focus:border-accent/40 focus:ring-accent/25"
                placeholder="you@company.com"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-white outline-none ring-1 ring-transparent transition placeholder:text-zinc-600 focus:border-accent/40 focus:ring-accent/25"
                placeholder="••••••••"
                required
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/25 transition hover:bg-blue-500"
            >
              Continue
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-zinc-600">Need an account? Your administrator can create one.</p>
      </div>
    </div>
  );
}
