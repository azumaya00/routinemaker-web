"use client";

// パスワードリセットの導線だけを先に固定する。
// 実送信は後で差し替えるため、表示と遷移だけを確定させる。

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Password reset</h1>
      <div className="text-xs text-slate-500">現在はUIのみ</div>
      {submitted ? (
        <div className="space-y-2 text-sm text-slate-600">
          <div>送信しました（仮）</div>
          <a className="underline" href="/login">
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
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              type="email"
            />
          </label>
          <button
            type="button"
            className="rounded border border-slate-200 px-3 py-2 text-sm"
            onClick={() => setSubmitted(true)}
          >
            Send reset link
          </button>
        </>
      )}
    </section>
  );
}
