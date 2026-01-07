"use client";

// Phase 1〜3 の認証判定を /api/me の成否に固定するための薄いラッパ。
// ここ以外に認証状態の分岐を置かないことで後続フェーズの迷いを防ぐ。

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import {
  type ApiResult,
  fetchMe,
  getCsrfCookie,
  login,
  logout,
  type UserSettings,
  updateSettings,
} from "@/lib/api";

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
  settings: UserSettings | null;
  error: string | null;
  isLoggingOut: boolean;
  finishLogout: () => void;
  me: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  saveSettings: (payload: Partial<UserSettings>) => Promise<ApiResult>;
};

// 画面側は AuthContext を経由して状態を読む前提。
const AuthContext = createContext<AuthContextValue | null>(null);

// 認証状態と操作を単一の Provider に集約する。
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // /api/me の結果だけで認証状態を確定する。
  const me = useCallback(async () => {
    setError(null);
    const result = await fetchMe();
    if (result.status === 200) {
      try {
        const payload = JSON.parse(result.body) as {
          data?: { user?: AuthUser; settings?: UserSettings };
        };
        setUser(payload.data?.user ?? null);
        setSettings(payload.data?.settings ?? null);
      } catch {
        setUser(null);
        setError("Failed to parse /api/me response.");
      }
      setStatus("authenticated");
      return;
    }

    if (result.status === 401) {
      setUser(null);
      setSettings(null);
      setStatus("unauthenticated");
      return;
    }

    setUser(null);
    setSettings(null);
    setStatus("unauthenticated");
    setError(result.body);
  }, []);

  // CSRF Cookie → login → /api/me の順序を固定して状態ズレを防ぐ。
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

  // ログアウト後に /api/me で状態を更新する。
  const handleLogout = useCallback(async () => {
    setError(null);
    setIsLoggingOut(true);
    setStatus("loading");
    setUser(null);
    setSettings(null);
    await getCsrfCookie();
    const result = await logout();
    if (result.status !== 204) {
      setError(result.body);
    }
    // ルーティングはガードに寄せるため、ここでは状態だけを未ログインに揃える。
    setStatus("unauthenticated");
  }, []);

  // ログアウト導線の完了後にだけフラグを戻す。
  const finishLogout = useCallback(() => {
    setIsLoggingOut(false);
  }, []);

  // 設定更新は API に寄せ、成功時だけローカルを更新する。
  const saveSettings = useCallback(async (payload: Partial<UserSettings>) => {
    setError(null);
    await getCsrfCookie();
    const result = await updateSettings(payload);
    if (result.status === 200) {
      try {
        const parsed = JSON.parse(result.body) as { data?: UserSettings };
        setSettings(parsed.data ?? null);
      } catch {
        setError("Failed to parse /api/settings response.");
      }
    } else if (result.status !== 204) {
      setError(result.body);
    }
    return result;
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      settings,
      error,
      isLoggingOut,
      finishLogout,
      me,
      login: handleLogin,
      logout: handleLogout,
      saveSettings,
    }),
    [
      status,
      user,
      settings,
      error,
      isLoggingOut,
      finishLogout,
      me,
      handleLogin,
      handleLogout,
      saveSettings,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 認証状態は Context 経由のみで扱う前提。
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
