"use client";

import { useEffect, useState } from "react";

import { apiRequest, type ApiResult } from "@/lib/api";

export default function Home() {
  const [email, setEmail] = useState("you@example.com");
  const [password, setPassword] = useState("password");
  const [csrfResult, setCsrfResult] = useState<ApiResult | null>(null);
  const [loginResult, setLoginResult] = useState<ApiResult | null>(null);
  const [logoutResult, setLogoutResult] = useState<ApiResult | null>(null);
  const [meResult, setMeResult] = useState<ApiResult | null>(null);
  const [authState, setAuthState] = useState<"unknown" | "authed" | "guest">(
    "unknown"
  );

  const renderResult = (result: ApiResult | null) => {
    if (!result) {
      return "status: -\nheaders: -\n(body will appear here)";
    }

    const headers = Object.entries(result.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

    return [
      `status: ${result.status}`,
      `headers:\n${headers || "-"}`,
      result.body,
    ].join("\n");
  };

  const checkMe = async () => {
    const result = await apiRequest("/api/me", { method: "GET" });
    setMeResult(result);
    if (result.status === 200) {
      setAuthState("authed");
    } else if (result.status === 401) {
      setAuthState("guest");
    } else {
      setAuthState("unknown");
    }
  };

  useEffect(() => {
    void checkMe();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12 text-slate-900">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Auth Check</h1>
        <p className="text-sm text-slate-600">
          Status:{" "}
          {authState === "authed"
            ? "authenticated"
            : authState === "guest"
            ? "unauthenticated"
            : "unknown"}
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-lg font-medium">Login</h2>
        <div className="grid gap-3">
          <label className="text-sm">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              type="email"
            />
          </label>
          <label className="text-sm">
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              type="password"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              onClick={async () =>
                setCsrfResult(
                  await apiRequest("/sanctum/csrf-cookie", { method: "GET" })
                )
              }
            >
              CSRF Cookie
            </button>
            <button
              type="button"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              onClick={async () => {
                const result = await apiRequest(
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
                setLoginResult(result);
                await checkMe();
              }}
            >
              Login
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
              onClick={checkMe}
            >
              Check /api/me
            </button>
          </div>
        </div>
        <div className="rounded-md bg-slate-50 p-3 text-sm">
          <pre className="whitespace-pre-wrap text-slate-700">
            {renderResult(csrfResult)}
          </pre>
        </div>
        <div className="rounded-md bg-slate-50 p-3 text-sm">
          <pre className="whitespace-pre-wrap text-slate-700">
            {renderResult(loginResult)}
          </pre>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Logout</h2>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            onClick={async () => {
              const result = await apiRequest(
                "/logout",
                { method: "POST" },
                { includeXsrfHeader: true }
              );
              setLogoutResult(result);
              await checkMe();
            }}
          >
            Logout
          </button>
        </div>
        <div className="rounded-md bg-slate-50 p-3 text-sm">
          <pre className="whitespace-pre-wrap text-slate-700">
            {renderResult(logoutResult)}
          </pre>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-lg font-medium">/api/me</h2>
        <div className="rounded-md bg-slate-50 p-3 text-sm">
          <pre className="whitespace-pre-wrap text-slate-700">
            {renderResult(meResult)}
          </pre>
        </div>
      </section>
    </main>
  );
}
