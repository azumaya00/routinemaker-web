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
  is_admin: boolean; // 管理者フラグ（APIから取得）
  tutorial_dismissed_at: string | null; // チュートリアル非表示日時（ISO8601形式）
  tutorial_should_show: boolean; // チュートリアル表示判定（tutorial_dismissed_at が null なら true）
};

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  settings: UserSettings | null;
  error: string | null;
  isLoggingOut: boolean;
  finishLogout: () => void;
  startLoggingOut: () => void; // 退会処理時にガードを無効化するために使用
  me: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  saveSettings: (payload: Partial<UserSettings>) => Promise<ApiResult>;
};

// 画面側は AuthContext を経由して状態を読む前提。
const AuthContext = createContext<AuthContextValue | null>(null);

// /api/me のキャッシュ管理（TTL + in-flight共有）
// グローバルスコープで管理し、複数のコンポーネント間で共有
let meCache: {
  data: { user: AuthUser | null; settings: UserSettings | null };
  timestamp: number;
} | null = null;
let meInFlight: Promise<void> | null = null;
const ME_CACHE_TTL = 30000; // 30秒（TTL）

// キャッシュを無効化する関数（新規登録後など、強制的に再取得したい場合に使用）
export const invalidateMeCache = () => {
  meCache = null;
  meInFlight = null;
};

// 認証状態と操作を単一の Provider に集約する。
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // /api/me の結果だけで認証状態を確定する。
  // TTLキャッシュとin-flight共有で重複呼び出しを削減
  const me = useCallback(async () => {
    // キャッシュが有効な場合はそれを使用（30秒以内）
    const now = Date.now();
    if (meCache && (now - meCache.timestamp) < ME_CACHE_TTL) {
      setUser(meCache.data.user);
      setSettings(meCache.data.settings);
      setStatus(meCache.data.user ? "authenticated" : "unauthenticated");
      setError(null);
      return;
    }

    // 既にリクエスト中の場合は、そのPromiseを共有
    if (meInFlight) {
      await meInFlight;
      // キャッシュが更新されている可能性があるので再チェック
      if (meCache && (now - meCache.timestamp) < ME_CACHE_TTL) {
        setUser(meCache.data.user);
        setSettings(meCache.data.settings);
        setStatus(meCache.data.user ? "authenticated" : "unauthenticated");
        setError(null);
        return;
      }
    }

    // 新しいリクエストを開始
    setError(null);
    meInFlight = (async () => {
      try {
        const result = await fetchMe();
        if (result.status === 200) {
          try {
            const payload = JSON.parse(result.body) as {
              data?: { user?: AuthUser; settings?: UserSettings };
            };
            const userData = payload.data?.user ?? null;
            const settingsData = payload.data?.settings ?? null;
            
            // キャッシュを更新
            meCache = {
              data: { user: userData, settings: settingsData },
              timestamp: Date.now(),
            };
            
            setUser(userData);
            setSettings(settingsData);
            setStatus("authenticated");
          } catch {
            setUser(null);
            setError("Failed to parse /api/me response.");
            // パースエラー時はキャッシュを無効化
            meCache = null;
          }
          return;
        }

        if (result.status === 401) {
          // 401時はキャッシュを即無効化し、ログアウト相当の状態へ
          meCache = null;
          setUser(null);
          setSettings(null);
          setStatus("unauthenticated");
          return;
        }

        // その他のエラーもキャッシュを無効化
        meCache = null;
        setUser(null);
        setSettings(null);
        setStatus("unauthenticated");
        setError(result.body);
      } finally {
        meInFlight = null;
      }
    })();

    await meInFlight;
  }, []);

  // CSRF Cookie → login → /api/me の順序を固定して状態ズレを防ぐ。
  const handleLogin = useCallback(
    async (email: string, password: string) => {
      setError(null);
      await getCsrfCookie();
      const result = await login(email, password);
      if (result.status !== 204) {
        // エラーメッセージをパースして設定
        try {
          const payload = JSON.parse(result.body) as {
            message?: string;
            errors?: Record<string, string[]>;
          };
          const errorMessage = payload.message ?? result.body;
          setError(errorMessage);
        } catch {
          setError(result.body);
        }
        return; // エラー時は me() を呼ばない
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
    // ログアウト時はキャッシュを無効化
    meCache = null;
    meInFlight = null;
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

  // 退会処理時にガードを無効化するために使用
  const startLoggingOut = useCallback(() => {
    setIsLoggingOut(true);
    setStatus("loading");
    setUser(null);
    setSettings(null);
    // キャッシュを無効化
    meCache = null;
    meInFlight = null;
  }, []);

  // 設定更新は API に寄せ、成功時だけローカルを更新する。
  const saveSettings = useCallback(async (payload: Partial<UserSettings>) => {
    setError(null);
    await getCsrfCookie();
    const result = await updateSettings(payload);
    if (result.status === 200) {
      try {
        const parsed = JSON.parse(result.body) as { data?: UserSettings };
        const newSettings = parsed.data ?? null;
        setSettings(newSettings);
        // 設定更新時はキャッシュも更新（ユーザー情報は変わらない前提）
        if (meCache) {
          meCache = {
            data: { user: meCache.data.user, settings: newSettings },
            timestamp: Date.now(),
          };
        }
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
      startLoggingOut,
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
      startLoggingOut,
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

