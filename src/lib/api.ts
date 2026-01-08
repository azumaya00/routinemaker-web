// Phase 1〜3 の API アクセスをこのファイルに集約して責務を固定する。
// 以降のフェーズで API 仕様が増えても呼び出し口はここに寄せる前提。
export type ApiResult = {
  status: number | "error";
  headers: Record<string, string>;
  body: string;
};

// 設定は API の user_settings に合わせた最小形で扱う
export type UserSettings = {
  theme: "light" | "soft" | "dark";
  dark_mode: "system" | "on" | "off";
  show_remaining_tasks: boolean;
  show_elapsed_time: boolean;
  show_celebration: boolean;
};

// 環境ごとの API を差し替えるための唯一の入口。
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001";

// Sanctum SPA の前提として XSRF-TOKEN は client 側で読む。
const readCookieValue = (name: string) => {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(prefix.length));
};

// エラーハンドリング用に最低限のヘッダーだけを残す。
const pickHeaders = (response: Response) => {
  const allowList = [
    "content-type",
    "cache-control",
    "date",
    "access-control-allow-origin",
    "access-control-allow-credentials",
  ];

  return allowList.reduce<Record<string, string>>((acc, key) => {
    const value = response.headers.get(key);
    if (value) {
      acc[key] = value;
    }
    return acc;
  }, {});
};

const formatBody = (text: string) => {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

type ApiRequestOptions = {
  includeXsrfHeader?: boolean;
};

// 認証方式を cookie に固定するため、credentials は常に include。
// CSRF が必要なルートだけ X-XSRF-TOKEN を付ける方針。
export const apiRequest = async (
  path: string,
  options: RequestInit = {},
  { includeXsrfHeader = false }: ApiRequestOptions = {}
): Promise<ApiResult> => {
  try {
    const headers = new Headers(options.headers);

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    if (includeXsrfHeader) {
      const token = readCookieValue("XSRF-TOKEN");
      if (token) {
        headers.set("X-XSRF-TOKEN", token);
      }
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      ...options,
      headers,
    });
    const text = await response.text();

    return {
      status: response.status,
      headers: pickHeaders(response),
      body: formatBody(text),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "error",
      headers: {},
      body: message,
    };
  }
};

// ログイン/ログアウト前に呼ぶ前提の CSRF 取得。
export const getCsrfCookie = () =>
  apiRequest("/sanctum/csrf-cookie", { method: "GET" });

// Sanctum SPA のセッション開始は POST /login で行う前提。
export const login = (email: string, password: string) =>
  apiRequest(
    "/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
    { includeXsrfHeader: true }
  );

// ログアウトはサーバ側のセッション破棄のみを担う。
export const logout = () =>
  apiRequest(
    "/logout",
    { method: "POST", keepalive: true },
    { includeXsrfHeader: true }
  );

// 登録は /register で行い、その後のセッション確立は API 側に寄せる。
export const register = (
  email: string,
  password: string,
  passwordConfirmation: string
) =>
  apiRequest(
    "/register",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        password_confirmation: passwordConfirmation,
      }),
    },
    { includeXsrfHeader: true }
  );

// /api/me の成否を認証状態の唯一の判断材料に固定する。
export const fetchMe = () => apiRequest("/api/me", { method: "GET" });
export const getMe = fetchMe;

// チュートリアルを非表示にする
export const dismissTutorial = () =>
  apiRequest(
    "/api/tutorial/dismiss",
    { method: "POST" },
    { includeXsrfHeader: true }
  );

// 設定は patch で更新し、レスポンスの settings を採用する前提。
export const updateSettings = (payload: Partial<UserSettings>) =>
  apiRequest(
    "/api/settings",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    { includeXsrfHeader: true }
  );

// Routine の Web 側モデルは最小形に固定する（Phase 3 まで）。
export type RoutinePayload = {
  title: string;
  tasks: string[];
};

// 以降の CRUD は api.ts からのみ呼ぶ前提で整理。
export const listRoutines = () => apiRequest("/api/routines", { method: "GET" });

// 実行画面で詳細を取得するための単体取得。
export const getRoutine = (id: number) =>
  apiRequest(`/api/routines/${id}`, { method: "GET" });

export const createRoutine = (payload: RoutinePayload) =>
  apiRequest(
    "/api/routines",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    { includeXsrfHeader: true }
  );

export const updateRoutine = (id: number, payload: RoutinePayload) =>
  apiRequest(
    `/api/routines/${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    { includeXsrfHeader: true }
  );

export const deleteRoutine = (id: number) =>
  apiRequest(
    `/api/routines/${id}`,
    { method: "DELETE" },
    { includeXsrfHeader: true }
  );

// 履歴は一覧と詳細で用途が分かれるため、取得口を明示的に分ける。
export const listHistories = (path = "/api/histories") =>
  apiRequest(path, { method: "GET" });

export const getHistory = (id: number) =>
  apiRequest(`/api/histories/${id}`, { method: "GET" });

// 実行体験は履歴 API に集約し、Web 側では流れの開始/完了/中断だけを担う。
export const startHistory = (routineId: number) =>
  apiRequest(
    `/api/routines/${routineId}/start`,
    { method: "POST" },
    { includeXsrfHeader: true }
  );

// 完了時は履歴 ID を使って確定させる前提。
export const completeHistory = (historyId: number) =>
  apiRequest(
    `/api/histories/${historyId}/complete`,
    { method: "POST" },
    { includeXsrfHeader: true }
  );

// 中断時も履歴 ID を使って状態を確定させる。
export const abortHistory = (historyId: number) =>
  apiRequest(
    `/api/histories/${historyId}/abort`,
    { method: "POST" },
    { includeXsrfHeader: true }
  );
