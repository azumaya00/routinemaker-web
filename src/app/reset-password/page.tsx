"use client";

// リセット完了画面はフローの固定が目的。API 接続は後で差し替える前提。
// payload は { email, token, password, password_confirmation } に固定しておく。

import { useState } from "react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="auth-page-container">
      {/* ページタイトル: 明確な余白で区切る */}
      <h1 className="auth-page-title">パスワード再設定</h1>
      
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
          <div className="auth-page-form auth-page-form-signup">
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
          
          <label className="auth-page-label">
            トークン
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="rm-input auth-page-input"
              type="text"
              placeholder="リセットトークンを入力"
            />
          </label>
          
          {/* パスワードと確認: 視覚的に"セット"として見えるよう調整 */}
          <label className="auth-page-label">
            新しいパスワード
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rm-input auth-page-input"
              type="password"
              placeholder="新しいパスワードを入力"
            />
          </label>
          
          <label className="auth-page-label">
            パスワード確認
            <input
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              className="rm-input auth-page-input"
              type="password"
              placeholder="パスワードを再入力"
            />
          </label>
          
          {/* アクションボタン: 1つだけ強調 */}
          <button
            type="button"
            className="rm-btn rm-btn-primary auth-page-button"
            onClick={() => setSubmitted(true)}
          >
            パスワードを再設定
          </button>
        </div>
        </>
      )}
    </section>
  );
}
