"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/lib/session-context";
import { UserMenu } from "@/components/UserMenu";
import { CompanyLogo } from "@/components/CompanyLogo";
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

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="ui-card p-6 shadow-sm md:p-7">
      <h2 className="text-base font-semibold tracking-tight text-white">{title}</h2>
      {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function AdminPage() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [keyForm, setKeyForm] = useState({ provider: "openai" as ProviderId, apiKey: "" });
  const [memberPatch, setMemberPatch] = useState<{
    userId: string;
    tokenQuotaMonthly: string;
    role: string;
  } | null>(null);

  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    role: "member" as "admin" | "member",
    tokenQuotaMonthly: "1000000",
  });

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
    setOkMsg(null);
    const res = await apiFetch("/api/admin/keys", {
      method: "POST",
      body: JSON.stringify(keyForm),
    });
    if (!res.ok) {
      setErr("Could not save API key.");
      return;
    }
    setKeyForm((k) => ({ ...k, apiKey: "" }));
    setOkMsg("API key saved.");
    void load();
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOkMsg(null);
    const res = await apiFetch("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: newUser.email.trim(),
        password: newUser.password,
        role: newUser.role,
        tokenQuotaMonthly: Number(newUser.tokenQuotaMonthly) || 1_000_000,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = (body as { error?: unknown }).error;
      const msg =
        typeof e === "string" ? e : e != null && typeof e === "object" ? "Invalid request" : "Could not create user.";
      setErr(msg);
      return;
    }
    setOkMsg(`User ${newUser.email.trim()} created. They can sign in now.`);
    setNewUser({ email: "", password: "", role: "member", tokenQuotaMonthly: "1000000" });
    void load();
  };

  const saveMember = async () => {
    if (!memberPatch) return;
    setOkMsg(null);
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
    setOkMsg("Member updated.");
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-700 border-t-accent" />
        <p className="mt-4 text-sm text-zinc-500">Loading admin…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 py-10 text-sm text-zinc-200 md:px-6 md:py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="ui-card flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/chat" className="shrink-0 rounded-lg py-1 transition hover:opacity-90">
              <CompanyLogo heightClass="h-9 sm:h-10" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl">Administration</h1>
              <p className="mt-1 text-sm text-zinc-500">Users, usage, API keys, and model access.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link href="/chat" className="ui-btn-secondary px-4 py-2 text-xs font-semibold">
              Back to chat
            </Link>
            <UserMenu />
          </div>
        </header>

        {err && (
          <p className="rounded-xl border border-red-500/30 bg-red-950/35 px-4 py-3 text-sm text-red-100">{err}</p>
        )}
        {okMsg && (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
            {okMsg}
          </p>
        )}

        {data && (
          <div className="space-y-8">
            <Card
              title="Create user"
              subtitle="Creates a new account with email and password. Share credentials securely with the teammate."
            >
              <form onSubmit={(e) => void createUser(e)} className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Email</span>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                    className="ui-field sm:col-span-2"
                    placeholder="colleague@company.com"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    Initial password
                  </span>
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={newUser.password}
                    onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                    className="ui-field sm:col-span-2"
                    placeholder="Min. 4 characters"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Role</span>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value as "admin" | "member" }))}
                    className="ui-field w-full"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    Monthly token quota
                  </span>
                  <input
                    type="number"
                    min={1000}
                    value={newUser.tokenQuotaMonthly}
                    onChange={(e) => setNewUser((u) => ({ ...u, tokenQuotaMonthly: e.target.value }))}
                    className="ui-field w-full"
                  />
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="ui-btn-primary px-5 py-2.5 text-sm"
                  >
                    Create user
                  </button>
                </div>
              </form>
            </Card>

            <Card
              title="Provider API keys"
              subtitle="Encrypted at rest. Members never see raw keys. Image generation uses the OpenAI key."
            >
              <div className="flex flex-wrap gap-2">
                <select
                  value={keyForm.provider}
                  onChange={(e) => setKeyForm((k) => ({ ...k, provider: e.target.value as ProviderId }))}
                  className="ui-field w-full max-w-[11rem] shrink-0 py-2.5 sm:w-auto"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <input
                  type="password"
                  placeholder="Paste API key"
                  value={keyForm.apiKey}
                  onChange={(e) => setKeyForm((k) => ({ ...k, apiKey: e.target.value }))}
                  className="ui-field min-w-[200px] flex-1 py-2"
                />
                <button
                  type="button"
                  onClick={() => void saveKey()}
                  className="inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-500/50 bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-white"
                >
                  Save key
                </button>
              </div>
              <ul className="mt-4 space-y-1 text-xs text-zinc-500">
                {data.keys.map((k) => (
                  <li key={k.provider}>
                    <span className="font-mono text-zinc-400">{k.provider}</span> — {k.active ? "stored" : "inactive"}
                  </li>
                ))}
                {data.keys.length === 0 && (
                  <li>None in database — environment variables used if set.</li>
                )}
              </ul>
            </Card>

            <Card
              title="Model allowlist"
              subtitle="Empty list means all default models are allowed. Disable models to restrict access."
            >
              <div className="grid gap-6 md:grid-cols-2">
                {(Object.keys(MODELS) as ProviderId[]).map((pid) => (
                  <div key={pid}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{pid}</p>
                    <ul className="space-y-1.5">
                      {MODELS[pid].map((m) => {
                        const row = data.allowlist.find((a) => a.provider === pid && a.modelId === m.id);
                        const allowed = !row || row.enabled;
                        return (
                          <li
                            key={m.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5 text-xs"
                          >
                            <span className="text-zinc-300">{m.label}</span>
                            <label className="flex cursor-pointer items-center gap-2 text-zinc-500">
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
            </Card>

            <div className="grid gap-8 lg:grid-cols-2">
              <Card title="Usage by provider">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-zinc-500">
                      <th className="pb-2 font-medium">Provider</th>
                      <th className="pb-2 font-medium">Tokens</th>
                      <th className="pb-2 font-medium">Est. cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.summary.byProvider.map((r) => (
                      <tr key={r.provider} className="border-t border-white/[0.06]">
                        <td className="py-2 font-mono text-zinc-300">{r.provider}</td>
                        <td>{r.tokens}</td>
                        <td>${r.cost.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <Card title="Usage by user">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-zinc-500">
                      <th className="pb-2 font-medium">Email</th>
                      <th className="pb-2 font-medium">Role</th>
                      <th className="pb-2 font-medium">Tokens</th>
                      <th className="pb-2 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.summary.byUser.map((r) => (
                      <tr key={r.id} className="border-t border-white/[0.06]">
                        <td className="max-w-[140px] truncate py-2 text-zinc-300" title={r.email}>
                          {r.email}
                        </td>
                        <td>{r.role}</td>
                        <td>{r.tokens}</td>
                        <td>${r.cost.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>

            <Card title="Team members" subtitle="Edit quotas and roles. Use Create user above to add accounts.">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead>
                    <tr className="text-zinc-500">
                      <th className="pb-2 font-medium">Email</th>
                      <th className="pb-2 font-medium">Role</th>
                      <th className="pb-2 font-medium">Used / quota</th>
                      <th className="pb-2 font-medium"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((m) => (
                      <tr key={m.id} className="border-t border-white/[0.06]">
                        <td className="py-2.5 font-mono text-[11px] text-zinc-300">{m.email}</td>
                        <td>{m.role}</td>
                        <td>
                          {m.tokensUsedMonth.toLocaleString()} / {m.tokenQuotaMonthly.toLocaleString()}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="font-medium text-accent hover:underline"
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
                <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-white/[0.06] pt-6">
                  <label className="text-xs text-zinc-500">
                    Monthly quota
                    <input
                      type="number"
                      className="ui-field ml-2 mt-1 inline-block w-40 py-2 text-xs"
                      value={memberPatch.tokenQuotaMonthly}
                      onChange={(e) =>
                        setMemberPatch((p) => (p ? { ...p, tokenQuotaMonthly: e.target.value } : p))
                      }
                    />
                  </label>
                  <label className="text-xs text-zinc-500">
                    Role
                    <select
                      className="ui-field ml-2 mt-1 inline-block py-2 pl-2 pr-8 text-xs"
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
                    className="ui-btn-primary px-4 py-2 text-xs"
                  >
                    Save changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemberPatch(null)}
                    className="text-xs font-medium text-zinc-500 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
