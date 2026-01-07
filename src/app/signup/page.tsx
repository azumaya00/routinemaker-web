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
  const passwordHint = "8文字以上・英字/数字を各1文字以上";

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
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Signup</h1>
      <div className="space-y-2 text-sm">
        <label className="block">
          <div className="rm-muted mb-1">Email</div>
          <input
            className="rm-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="block">
          <div className="rm-muted mb-1">Password</div>
          <div className="rm-muted mb-1 text-xs">{passwordHint}</div>
          <input
            className="rm-input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label className="block">
          <div className="rm-muted mb-1">Confirm Password</div>
          <div className="rm-muted mb-1 text-xs">{passwordHint}</div>
          <input
            className="rm-input"
            type="password"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
          />
        </label>
      </div>
      {error && (
        <div className="rm-danger rm-card text-sm">
          {error}
        </div>
      )}
      <button
        type="button"
        className="rm-btn rm-btn-primary"
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
        Create account
      </button>
    </section>
  );
}
