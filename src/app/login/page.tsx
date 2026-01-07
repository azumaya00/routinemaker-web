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
  const [email, setEmail] = useState("you@example.com");
  const [password, setPassword] = useState("password");
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
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Login</h1>
      <div className="grid gap-3">
        <label className="text-sm">
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rm-input mt-1"
            type="email"
          />
        </label>
        <label className="text-sm">
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rm-input mt-1"
            type="password"
          />
        </label>
        <button
          type="button"
          className="rm-btn rm-btn-primary"
          onClick={() => void login(email, password)}
        >
          Login
        </button>
        <Link className="rm-link text-sm" href="/forgot-password">
          パスワードを忘れた場合
        </Link>
        {errorMessage ? (
          <div className="rm-danger text-sm">{errorMessage}</div>
        ) : null}
      </div>
    </section>
  );
}
