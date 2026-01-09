"use client";

/**
 * ログインページ
 * 
 * 責務：
 * - ログイン機能の提供
 * - 認証済みの場合は /routines にリダイレクト
 * 
 * レイアウト責務：
 * - AppShellのMain領域に表示するコンテンツのみを返す
 * - Header/FooterのレイアウトはAppShell側で制御されるため考慮不要
 * - このページは非ログイン時なので、Footerが表示される
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { status, login, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const errorMessage = useMemo(() => {
    if (!error) {
      return null;
    }
    // 失敗理由の詳細は出さず、認証情報の不一致として扱う。
    if (error.includes("Failed to fetch")) {
      return "ログインに失敗しました。APIに接続できません。";
    }
    return "メールもしくはパスワードが異なります。";
  }, [error]);

  // 認証済みの場合はここに留まらず / へ戻す。
  useEffect(() => {
    if (status === "authenticated") {
      // ログイン後はトップを挟まず /routines へ直行させる。
      router.push("/routines");
    }
  }, [status, router]);

  return (
    <section className="auth-page-container">
      {/* ページタイトル: 明確な余白で区切る */}
      <h1 className="auth-page-title">ログイン</h1>
      
      {/* フォーム本体: 入力欄とボタンを縦に配置 */}
      <div className="auth-page-form">
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
          パスワード
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rm-input auth-page-input"
            type="password"
            placeholder="パスワードを入力"
          />
        </label>
        
        {/* エラーメッセージ: 入力欄の直後に表示 */}
        {errorMessage ? (
          <div className="auth-page-error">{errorMessage}</div>
        ) : null}
        
        {/* アクションボタン: 入力欄との間に明確な余白 */}
        <button
          type="button"
          className="rm-btn rm-btn-primary auth-page-button"
          onClick={() => void login(email, password)}
        >
          ログイン
        </button>
        
        {/* 補助リンク: ボタンの直下、小さめ・目立たせすぎない */}
        <Link className="auth-page-link" href="/forgot-password">
          パスワードを忘れた場合
        </Link>
      </div>
    </section>
  );
}
