import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getToken, onUnauthorized, setToken } from "../api/client";
import type { User } from "../api/types";

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  useEffect(
    () =>
      onUnauthorized(() => {
        setToken(null);
        setUser(null);
      }),
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ access_token: string; user: User }>("/auth/login", { method: "POST", json: { email, password } });
    setToken(r.access_token);
    setUser(r.user);
  }, []);

  const register = useCallback(async (email: string, password: string, display_name: string) => {
    const r = await api<{ access_token: string; user: User }>("/auth/register", {
      method: "POST",
      json: { email, password, display_name },
    });
    setToken(r.access_token);
    setUser(r.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    await api("/auth/me", { method: "DELETE" });
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, logout, deleteAccount }),
    [user, ready, login, register, logout, deleteAccount],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
