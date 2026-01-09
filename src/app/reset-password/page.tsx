"use client";

/**
 * パスワード再設定画面
 * 
 * 責務：
 * - メール内リンクから token と email を取得
 * - 新しいパスワード入力とリセット実行
 * - 成功時にログイン画面へ遷移
 */

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { resetPassword } from "@/lib/api";
import { useFlash } from "@/components/FlashMessageProvider";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showFlash } = useFlash();
  
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // query string から token と email を取得
  useEffect(() => {
    const tokenParam = searchParams.get("token");
    const emailParam = searchParams.get("email");
    if (tokenParam) {
      setToken(tokenParam);
    }
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }
  }, [searchParams]);

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
    if (!token || !email) {
      setError("リセットリンクが無効です。メールから再度アクセスしてください。");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await resetPassword(
        token,
        email,
        password,
        passwordConfirmation
      );
      if (result.status === 200) {
        showFlash("success", "パスワードをリセットしました。");
        router.push("/login");
      } else {
        setError(formatError(result.body));
        showFlash("error", "パスワードリセットに失敗しました。");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      showFlash("error", "パスワードリセットに失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-page-container">
      {/* ページタイトル: 明確な余白で区切る */}
      <h1 className="auth-page-title">パスワード再設定</h1>
      
      {/* フォーム本体: 「今やることが1つ」だと分かるレイアウト */}
      <div className="auth-page-form auth-page-form-signup">
        {/* token と email が取得できない場合のエラー表示 */}
        {(!token || !email) && (
          <div className="auth-page-error">
            リセットリンクが無効です。メールから再度アクセスしてください。
          </div>
        )}
        
        <label className="auth-page-label">
          メールアドレス
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rm-input auth-page-input"
            type="email"
            placeholder="example@email.com"
            disabled={isSubmitting || !!searchParams.get("email")}
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
            placeholder="8文字以上・英字/数字を各1文字以上"
            disabled={isSubmitting}
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
          disabled={isSubmitting || !token || !email}
        >
          {isSubmitting ? "処理中..." : "パスワードを再設定"}
        </button>
        
        {/* 補助リンク: ボタンの直下、小さめ・目立たせすぎない */}
        <Link className="auth-page-link" href="/login">
          ログインに戻る
        </Link>
      </div>
    </section>
  );
}
