"use client";

/**
 * パスワードリセット画面
 * 
 * 責務：
 * - メールアドレス入力とリセットリンク送信
 * - 送信成功時のメッセージ表示
 */

import { useState } from "react";
import Link from "next/link";

import { forgotPassword } from "@/lib/api";
import { useFlash } from "@/components/FlashMessageProvider";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showFlash } = useFlash();

  const formatError = (raw: string) => {
    try {
      const payload = JSON.parse(raw) as {
        message?: string;
        errors?: Record<string, string[]>;
      };
      const items = payload.errors
        ? Object.values(payload.errors).flat().filter(Boolean)
        : [];
      if (items.length > 0) {
        return items.join("\n");
      }
      return payload.message ?? raw;
    } catch {
      return raw;
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await forgotPassword(email);
      if (result.status === 200) {
        setSubmitted(true);
        showFlash("success", "パスワードリセットリンクを送信しました。");
      } else {
        setError(formatError(result.body));
        showFlash("error", "送信に失敗しました。もう一度お試しください。");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      showFlash("error", "送信に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-page-container">
      {/* ページタイトル: 明確な余白で区切る */}
      <h1 className="auth-page-title">パスワードリセット</h1>
      
      {submitted ? (
        <>
          {/* 送信完了状態: 静かに完了を伝える */}
          <div className="auth-page-form">
            <div className="auth-page-message">
              メールを送信しました。届かない場合は迷惑メールフォルダ等もご確認ください。
            </div>
            <Link className="auth-page-link" href="/login">
              ログインに戻る
            </Link>
          </div>
        </>
      ) : (
        <>
          {/* フォーム本体: 「今やることが1つ」だと分かるレイアウト */}
          <div className="auth-page-form">
            <label className="auth-page-label">
              メールアドレス
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rm-input auth-page-input"
                type="email"
                placeholder="example@email.com"
                disabled={isSubmitting}
              />
            </label>
            
            {/* エラーメッセージ: 入力欄の直後に表示 */}
            {error && (
              <div className="auth-page-error">{error}</div>
            )}
            
            {/* アクションボタン: 1つだけ強調 */}
            <button
              type="button"
              className="rm-btn rm-btn-primary auth-page-button"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "送信中..." : "リセットリンクを送信"}
            </button>
            
            {/* 補助リンク: ボタンの直下、小さめ・目立たせすぎない */}
            <Link className="auth-page-link" href="/login">
              ログインに戻る
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
