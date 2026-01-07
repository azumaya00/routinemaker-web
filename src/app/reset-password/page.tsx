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
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Reset password</h1>
      <div className="rm-muted text-xs">現在はUIのみ</div>
      {submitted ? (
        <div className="rm-muted space-y-2 text-sm">
          <div>送信しました（仮）</div>
          <a className="rm-link" href="/login">
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
              className="rm-input mt-1"
              type="email"
            />
          </label>
          <label className="block">
            Token
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="rm-input mt-1"
              type="text"
            />
          </label>
          <label className="block">
            New Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rm-input mt-1"
              type="password"
            />
          </label>
          <label className="block">
            Confirm Password
            <input
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              className="rm-input mt-1"
              type="password"
            />
          </label>
          <button
            type="button"
            className="rm-btn rm-btn-primary"
            onClick={() => setSubmitted(true)}
          >
            Reset password
          </button>
        </div>
      )}
    </section>
  );
}
