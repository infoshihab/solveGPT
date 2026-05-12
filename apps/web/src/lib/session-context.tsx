"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, setStoredToken } from "@/lib/api";

export type SessionUser = {
  id: string;
  email: string;
  role: string;
  tokenQuotaMonthly?: number;
  tokensUsedMonth?: number;
};

type Ctx = {
  user: SessionUser | null;
  loading: boolean;
  bootError: string | null;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const SessionContext = createContext<Ctx | null>(null);

export function useSession(): Ctx {
  const c = useContext(SessionContext);
  if (!c) throw new Error("useSession must be used inside SessionProvider");
  return c;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBootError(null);
    setLoading(true);
    try {
      const r = await apiFetch("/api/me", { signal: AbortSignal.timeout(20_000) });
      if (!r.ok) {
        setStoredToken(null);
        setUser(null);
        return;
      }
      const d = (await r.json()) as { user: SessionUser };
      setUser(d.user);
    } catch (e) {
      setStoredToken(null);
      setUser(null);
      const msg =
        e instanceof Error
          ? e.name === "AbortError"
            ? "API did not respond in time. Is it running on port 4000?"
            : e.message.includes("fetch")
              ? "Cannot reach API. Check NEXT_PUBLIC_API_URL and that the API is running."
              : e.message
          : "Session check failed";
      setBootError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const r = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) {
      const errBody = await r.json().catch(() => ({}));
      throw new Error((errBody as { error?: string }).error ?? "Login failed");
    }
    const d = (await r.json()) as { token: string; user: SessionUser };
    setStoredToken(d.token);
    setUser(d.user);
    setBootError(null);
  };

  const logout = () => {
    setStoredToken(null);
    setUser(null);
    setBootError(null);
    void apiFetch("/api/auth/logout", { method: "POST" });
  };

  return (
    <SessionContext.Provider value={{ user, loading, bootError, refresh, login, logout }}>
      {children}
    </SessionContext.Provider>
  );
}
