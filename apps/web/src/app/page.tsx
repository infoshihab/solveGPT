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
      <div className="flex min-h-screen items-center justify-center bg-surface text-zinc-500">Loading…</div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-surface px-4 py-10">
      <CompanyLogo heightClass="h-14" priority />
      <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm space-y-4 rounded-xl border border-surface-border bg-surface-raised p-6 shadow-xl">
        <h1 className="text-center text-lg font-semibold text-white">Sign in</h1>
        {bootError && (
          <div className="space-y-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-100">
            <p>{bootError}</p>
            <button
              type="button"
              className="text-xs text-accent underline"
              onClick={() => void refresh()}
            >
              Retry
            </button>
          </div>
        )}
        {err && <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-center text-sm text-red-200">{err}</p>}
        <label className="block text-xs text-zinc-500">
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none ring-accent focus:ring-1"
            required
          />
        </label>
        <label className="block text-xs text-zinc-500">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none ring-accent focus:ring-1"
            required
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          Continue
        </button>
      </form>
      <p className="text-center text-xs text-zinc-600">
        Need an account? Ask an administrator.
      </p>
    </div>
  );
}
