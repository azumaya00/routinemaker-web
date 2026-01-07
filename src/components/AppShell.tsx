"use client";

// Phase 2.5 の最小レイアウト枠。今後の UI 構成はここを基準に拡張する。

import Link from "next/link";
import { useEffect } from "react";

import { AuthProvider, useAuth } from "@/hooks/useAuth";

// 認証状態に応じて Login/Logout だけを出し分ける。
const Header = () => {
  const { status, logout, me } = useAuth();

  // ヘッダー表示前に /api/me を必ず実行して状態を確定させる。
  useEffect(() => {
    void me();
  }, [me]);

  return (
    <header className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
      <div className="text-sm font-semibold">Routinemaker</div>
      <div className="flex items-center gap-2 text-sm">
        {status === "authenticated" ? (
          <button
            type="button"
            className="rounded border border-slate-200 px-3 py-1"
            onClick={() => void logout()}
          >
            Logout
          </button>
        ) : (
          <Link className="rounded border border-slate-200 px-3 py-1" href="/login">
            Login
          </Link>
        )}
      </div>
    </header>
  );
};

// ページ共通の枠として header/main を固定する。
export const AppShell = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-8">{children}</main>
    </div>
  </AuthProvider>
);
