"use client";

// パスワードリセットの導線だけを先に固定する。
// 実送信は後で差し替えるため、表示と遷移だけを確定させる。

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Password reset</h1>
      <div className="rm-muted text-xs">現在はUIのみ</div>
      {submitted ? (
        <div className="rm-muted space-y-2 text-sm">
          <div>送信しました（仮）</div>
          <a className="rm-link" href="/login">
            ログインに戻る
          </a>
        </div>
      ) : (
        <>
          <label className="block text-sm">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rm-input mt-1"
              type="email"
            />
          </label>
          <button
            type="button"
            className="rm-btn rm-btn-primary"
            onClick={() => setSubmitted(true)}
          >
            Send reset link
          </button>
        </>
      )}
    </section>
  );
}
