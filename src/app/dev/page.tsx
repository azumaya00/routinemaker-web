"use client";

import { useState } from "react";

import { apiRequest, type ApiResult } from "@/lib/api";

const LOGIN_EMAIL = "you@example.com";
const LOGIN_PASSWORD = "password";

export default function DevPage() {
  const [csrfResult, setCsrfResult] = useState<ApiResult | null>(null);
  const [loginResult, setLoginResult] = useState<ApiResult | null>(null);
  const [meResult, setMeResult] = useState<ApiResult | null>(null);
  const [logoutResult, setLogoutResult] = useState<ApiResult | null>(null);

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

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 text-slate-900">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">API Dev Check</h1>
        <p className="text-sm text-slate-600">
          CSRF → Login → Me の順で実行してください。
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">GET /sanctum/csrf-cookie</h2>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            onClick={async () =>
              setCsrfResult(
                await apiRequest("/sanctum/csrf-cookie", { method: "GET" }, {
                  includeXsrfHeader: false,
                })
              )
            }
          >
            Run
          </button>
        </div>
        <div className="rounded-md bg-slate-50 p-3 text-sm">
          <pre className="whitespace-pre-wrap text-slate-700">
            {renderResult(csrfResult)}
          </pre>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">POST /login</h2>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            onClick={async () =>
              setLoginResult(
                await apiRequest(
                  "/login",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      email: LOGIN_EMAIL,
                      password: LOGIN_PASSWORD,
                    }),
                  },
                  { includeXsrfHeader: true }
                )
              )
            }
          >
            Run
          </button>
        </div>
        <div className="rounded-md bg-slate-50 p-3 text-sm">
          <pre className="whitespace-pre-wrap text-slate-700">
            {renderResult(loginResult)}
          </pre>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">GET /api/me (with cookies)</h2>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            onClick={async () =>
              setMeResult(
                await apiRequest("/api/me", { method: "GET" }, {
                  includeXsrfHeader: false,
                })
              )
            }
          >
            Run
          </button>
        </div>
        <div className="rounded-md bg-slate-50 p-3 text-sm">
          <pre className="whitespace-pre-wrap text-slate-700">
            {renderResult(meResult)}
          </pre>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">POST /logout</h2>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            onClick={async () =>
              setLogoutResult(
                await apiRequest(
                  "/logout",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                  },
                  { includeXsrfHeader: true }
                )
              )
            }
          >
            Run
          </button>
        </div>
        <div className="rounded-md bg-slate-50 p-3 text-sm">
          <pre className="whitespace-pre-wrap text-slate-700">
            {renderResult(logoutResult)}
          </pre>
        </div>
      </section>
    </main>
  );
}
