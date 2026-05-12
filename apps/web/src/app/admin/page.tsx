"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { UserMenu } from "@/components/UserMenu";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { MODELS, PROVIDERS, type ProviderId } from "@/lib/models";

type Overview = {
  summary: {
    byUser: { id: string; email: string; role: string; cost: number; tokens: number }[];
    byProvider: { provider: string; cost: number; tokens: number }[];
  };
  members: { id: string; email: string; role: string; tokenQuotaMonthly: number; tokensUsedMonth: number }[];
  keys: { provider: string; active: boolean }[];
  allowlist: { provider: string; modelId: string; enabled: boolean }[];
};

export default function AdminPage() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [keyForm, setKeyForm] = useState({ provider: "openai" as ProviderId, apiKey: "" });
  const [memberPatch, setMemberPatch] = useState<{
    userId: string;
    tokenQuotaMonthly: string;
    role: string;
  } | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/admin/overview");
    if (res.status === 403) {
      setErr("You need admin access.");
      return;
    }
    if (!res.ok) {
      setErr("Failed to load admin data.");
      return;
    }
    setErr(null);
    setData((await res.json()) as Overview);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
      return;
    }
    if (!loading && user && user.role !== "admin") {
      router.replace("/chat");
      return;
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.role === "admin") void load();
  }, [user, load]);

  const saveKey = async () => {
    const res = await apiFetch("/api/admin/keys", {
      method: "POST",
      body: JSON.stringify(keyForm),
    });
    if (!res.ok) {
      setErr("Could not save API key.");
      return;
    }
    setKeyForm((k) => ({ ...k, apiKey: "" }));
    void load();
  };

  const saveMember = async () => {
    if (!memberPatch) return;
    const res = await apiFetch("/api/admin/members", {
      method: "PATCH",
      body: JSON.stringify({
        userId: memberPatch.userId,
        tokenQuotaMonthly: Number(memberPatch.tokenQuotaMonthly),
        role: memberPatch.role,
      }),
    });
    if (!res.ok) {
      setErr("Could not update member.");
      return;
    }
    setMemberPatch(null);
    void load();
  };

  const toggleAllow = async (provider: ProviderId, modelId: string, enabled: boolean) => {
    await apiFetch("/api/admin/allowlist", {
      method: "POST",
      body: JSON.stringify({ provider, modelId, enabled }),
    });
    void load();
  };

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-zinc-500">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 py-8 text-sm text-zinc-200">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/chat" className="shrink-0 py-1 hover:opacity-90">
              <CompanyLogo heightClass="h-9" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-white">Admin</h1>
              <p className="text-zinc-500">Usage, quotas, provider keys, and model access.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/chat" className="text-accent hover:underline">
              Back to chat
            </Link>
            <UserMenu />
          </div>
        </header>

        {err && <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-200">{err}</p>}

        {data && (
          <>
            <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Provider API keys</h2>
              <p className="mb-3 text-xs text-zinc-500">
                Keys are encrypted at rest. Team members never see raw secrets.
              </p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={keyForm.provider}
                  onChange={(e) => setKeyForm((k) => ({ ...k, provider: e.target.value as ProviderId }))}
                  className="rounded border border-surface-border bg-surface px-2 py-1"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <input
                  type="password"
                  placeholder="Paste provider API key"
                  value={keyForm.apiKey}
                  onChange={(e) => setKeyForm((k) => ({ ...k, apiKey: e.target.value }))}
                  className="min-w-[240px] flex-1 rounded border border-surface-border bg-surface px-2 py-1"
                />
                <button
                  type="button"
                  onClick={() => void saveKey()}
                  className="rounded bg-accent px-3 py-1 text-white hover:bg-blue-500"
                >
                  Save key
                </button>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-zinc-500">
                {data.keys.map((k) => (
                  <li key={k.provider}>
                    {k.provider}: {k.active ? "stored" : "inactive"}
                  </li>
                ))}
                {data.keys.length === 0 && <li>No database keys yet — using server environment fallbacks if set.</li>}
              </ul>
            </section>

            <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Model allowlist</h2>
              <p className="mb-3 text-xs text-zinc-500">
                When the list is empty, all default models are allowed. Add rows to restrict to specific models only.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {(Object.keys(MODELS) as ProviderId[]).map((pid) => (
                  <div key={pid}>
                    <p className="mb-2 text-xs font-medium text-zinc-400">{pid}</p>
                    <ul className="space-y-1">
                      {MODELS[pid].map((m) => {
                        const row = data.allowlist.find((a) => a.provider === pid && a.modelId === m.id);
                        const allowed = !row || row.enabled;
                        return (
                          <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                            <span>{m.label}</span>
                            <label className="flex items-center gap-1 text-zinc-500">
                              <input
                                type="checkbox"
                                checked={allowed}
                                onChange={(e) => void toggleAllow(pid, m.id, e.target.checked)}
                              />
                              allowed
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Usage by provider</h2>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-zinc-500">
                    <th className="py-1">Provider</th>
                    <th className="py-1">Tokens</th>
                    <th className="py-1">Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.summary.byProvider.map((r) => (
                    <tr key={r.provider} className="border-t border-surface-border">
                      <td className="py-2">{r.provider}</td>
                      <td>{r.tokens}</td>
                      <td>${r.cost.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Team members</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="text-zinc-500">
                      <th className="py-1">Email</th>
                      <th className="py-1">Role</th>
                      <th className="py-1">Quota / used</th>
                      <th className="py-1"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((m) => (
                      <tr key={m.id} className="border-t border-surface-border">
                        <td className="py-2">{m.email}</td>
                        <td>{m.role}</td>
                        <td>
                          {m.tokensUsedMonth} / {m.tokenQuotaMonthly}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="text-accent hover:underline"
                            onClick={() =>
                              setMemberPatch({
                                userId: m.id,
                                tokenQuotaMonthly: String(m.tokenQuotaMonthly),
                                role: m.role,
                              })
                            }
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {memberPatch && (
                <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-surface-border pt-4">
                  <label className="text-xs text-zinc-500">
                    Monthly token quota
                    <input
                      type="number"
                      className="ml-1 rounded border border-surface-border bg-surface px-2 py-1"
                      value={memberPatch.tokenQuotaMonthly}
                      onChange={(e) =>
                        setMemberPatch((p) => (p ? { ...p, tokenQuotaMonthly: e.target.value } : p))
                      }
                    />
                  </label>
                  <label className="text-xs text-zinc-500">
                    Role
                    <select
                      className="ml-1 rounded border border-surface-border bg-surface px-2 py-1"
                      value={memberPatch.role}
                      onChange={(e) =>
                        setMemberPatch((p) => (p ? { ...p, role: e.target.value } : p))
                      }
                    >
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void saveMember()}
                    className="rounded bg-accent px-3 py-1 text-white hover:bg-blue-500"
                  >
                    Save member
                  </button>
                  <button type="button" onClick={() => setMemberPatch(null)} className="text-zinc-500 hover:text-white">
                    Cancel
                  </button>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-surface-border bg-surface-raised p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Usage by user</h2>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-zinc-500">
                    <th className="py-1">Email</th>
                    <th className="py-1">Role</th>
                    <th className="py-1">Tokens</th>
                    <th className="py-1">Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.summary.byUser.map((r) => (
                    <tr key={r.id} className="border-t border-surface-border">
                      <td className="py-2">{r.email}</td>
                      <td>{r.role}</td>
                      <td>{r.tokens}</td>
                      <td>${r.cost.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
