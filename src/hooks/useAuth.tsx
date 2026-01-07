"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { fetchMe, getCsrfCookie, login, logout } from "@/lib/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthUser = {
  id: number;
  name: string;
  email: string;
  plan: string;
};

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  me: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const me = useCallback(async () => {
    setError(null);
    const result = await fetchMe();
    if (result.status === 200) {
      try {
        const payload = JSON.parse(result.body) as {
          data?: { user?: AuthUser };
        };
        setUser(payload.data?.user ?? null);
      } catch {
        setUser(null);
        setError("Failed to parse /api/me response.");
      }
      setStatus("authenticated");
      return;
    }

    if (result.status === 401) {
      setUser(null);
      setStatus("unauthenticated");
      return;
    }

    setUser(null);
    setStatus("unauthenticated");
    setError(result.body);
  }, []);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      setError(null);
      await getCsrfCookie();
      const result = await login(email, password);
      if (result.status !== 204) {
        setError(result.body);
      }
      await me();
    },
    [me]
  );

  const handleLogout = useCallback(async () => {
    setError(null);
    await getCsrfCookie();
    const result = await logout();
    if (result.status !== 204) {
      setError(result.body);
    }
    await me();
  }, [me]);

  const value = useMemo(
    () => ({
      status,
      user,
      error,
      me,
      login: handleLogin,
      logout: handleLogout,
    }),
    [status, user, error, me, handleLogin, handleLogout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
