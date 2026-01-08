"use client";

// サインアップ画面の存在と最小登録フローだけを用意する。
// 本格的なプロフィール入力や確認フローは Phase 5 以降で検討する。

import { useState } from "react";
import { useRouter } from "next/navigation";

import { getCsrfCookie, register } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export default function SignupPage() {
  const router = useRouter();
  const { me } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  return (
    <section className="auth-page-container">
      {/* ページタイトル: 明確な余白で区切る */}
      <h1 className="auth-page-title">アカウント登録</h1>
      
      {/* フォーム本体: 入力項目が多いため、余白を広めに */}
      <div className="auth-page-form auth-page-form-signup">
        <label className="auth-page-label">
          メールアドレス
          <input
            className="rm-input auth-page-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="example@email.com"
          />
        </label>
        
        <label className="auth-page-label">
          パスワード
          <input
            className="rm-input auth-page-input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="8文字以上・英字/数字を各1文字以上"
          />
        </label>
        
        {/* パスワード確認: 視覚的に"セット"として見えるよう調整 */}
        <label className="auth-page-label">
          パスワード確認
          <input
            className="rm-input auth-page-input"
            type="password"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            placeholder="パスワードを再入力"
          />
        </label>
        
        {/* エラーメッセージ: 入力欄の直後に表示 */}
        {error && (
          <div className="auth-page-error">{error}</div>
        )}
        
        {/* アクションボタン: フォームの終わりが明確に分かる位置に */}
        <button
          type="button"
          className="rm-btn rm-btn-primary auth-page-button"
          onClick={async () => {
            // 登録とセッション確立を API 側に任せ、完了後に /api/me で状態を同期する。
            setError(null);
            await getCsrfCookie();
            const result = await register(
              email,
              password,
              passwordConfirmation
            );
            if (result.status !== 204) {
              setError(formatError(result.body));
              return;
            }
            await me();
            router.push("/routines");
          }}
        >
          登録する
        </button>
      </div>
    </section>
  );
}
