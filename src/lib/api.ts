export type ApiResult = {
  status: number | "error";
  headers: Record<string, string>;
  body: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001";

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

export const getCsrfCookie = () =>
  apiRequest("/sanctum/csrf-cookie", { method: "GET" });

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

export const logout = () =>
  apiRequest(
    "/logout",
    { method: "POST" },
    { includeXsrfHeader: true }
  );

export const fetchMe = () => apiRequest("/api/me", { method: "GET" });
