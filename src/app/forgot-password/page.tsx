"use client";

// パスワードリセットの導線だけを先に固定する。
// 実送信は後で差し替えるため、表示と遷移だけを確定させる。

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="auth-page-container">
      {/* ページタイトル: 明確な余白で区切る */}
      <h1 className="auth-page-title">パスワードリセット</h1>
      
      {submitted ? (
        <>
          {/* 送信完了状態: 静かに完了を伝える */}
          <div className="auth-page-form">
            <div className="auth-page-message">送信しました（仮）</div>
            <Link className="auth-page-link" href="/login">
              ログインに戻る
            </Link>
          </div>
        </>
      ) : (
        <>
          {/* フォーム本体: 「今やることが1つ」だと分かるレイアウト */}
          <div className="auth-page-form">
          {/* 説明文: 短く、入力欄の直前に置く */}
          <div className="auth-page-hint">現在はUIのみ</div>
          
          <label className="auth-page-label">
            メールアドレス
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rm-input auth-page-input"
              type="email"
              placeholder="example@email.com"
            />
          </label>
          
          {/* アクションボタン: 1つだけ強調 */}
          <button
            type="button"
            className="rm-btn rm-btn-primary auth-page-button"
            onClick={() => setSubmitted(true)}
          >
            リセットリンクを送信
          </button>
        </div>
        </>
      )}
    </section>
  );
}
