"use client";

// リセット完了画面はフローの固定が目的。API 接続は後で差し替える前提。
// payload は { email, token, password, password_confirmation } に固定しておく。

import { useState } from "react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Reset password</h1>
      <div className="text-xs text-slate-500">現在はUIのみ</div>
      {submitted ? (
        <div className="space-y-2 text-sm text-slate-600">
          <div>送信しました（仮）</div>
          <a className="underline" href="/login">
            ログインに戻る
          </a>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <label className="block">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              type="email"
            />
          </label>
          <label className="block">
            Token
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              type="text"
            />
          </label>
          <label className="block">
            New Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              type="password"
            />
          </label>
          <label className="block">
            Confirm Password
            <input
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              type="password"
            />
          </label>
          <button
            type="button"
            className="rounded border border-slate-200 px-3 py-2 text-sm"
            onClick={() => setSubmitted(true)}
          >
            Reset password
          </button>
        </div>
      )}
    </section>
  );
}
