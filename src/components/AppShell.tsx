"use client";

// Phase 2.5 以降の最小レイアウト枠。ナビは要件の主要画面に限定する。

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AuthProvider, useAuth } from "@/hooks/useAuth";

// 認証状態に応じて主要導線を出し分け、画面責務の混在を避ける。
const Header = () => {
  const { status, logout, me, isLoggingOut, finishLogout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const publicPaths = useMemo(
    () => ["/", "/login", "/signup", "/forgot-password", "/reset-password"],
    []
  );
  const protectedPrefixes = useMemo(
    () => ["/routines", "/run", "/histories", "/settings"],
    []
  );

  // ログイン不要ページは明示的に固定し、ガード判定を単純化する。
  const isPublicPath = useMemo(
    () => publicPaths.includes(pathname),
    [publicPaths, pathname]
  );
  const isProtectedPath = useMemo(
    () => protectedPrefixes.some((prefix) => pathname.startsWith(prefix)),
    [protectedPrefixes, pathname]
  );

  // ヘッダー表示前に /api/me を必ず実行して状態を確定させる。
  useEffect(() => {
    void me();
  }, [me]);

  // 未ログインで protected に入った場合のみ /login に寄せる。
  useEffect(() => {
    if (status === "unauthenticated" && isProtectedPath && !isPublicPath) {
      // ログアウト中は TOP に戻すため、/login への吸い込みを抑止する。
      if (isLoggingOut) {
        return;
      }
      router.replace("/login");
    }
  }, [status, isProtectedPath, isPublicPath, isLoggingOut, router]);

  // ログアウト後に TOP へ着地したらフラグを戻す。
  useEffect(() => {
    if (isLoggingOut && pathname === "/") {
      finishLogout();
    }
  }, [isLoggingOut, pathname, finishLogout]);

  return (
    <header className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
      <div className="text-sm font-semibold">Routinemaker</div>
      <div className="flex items-center gap-2 text-sm">
        {status === "authenticated" ? (
          <>
            <Link className="rounded border border-slate-200 px-3 py-1" href="/routines">
              Routines
            </Link>
            <Link className="rounded border border-slate-200 px-3 py-1" href="/histories">
              Histories
            </Link>
            <button
              type="button"
              className="rounded border border-slate-200 px-3 py-1"
              onClick={async (event) => {
                // クリックで遷移が走ると fetch が中断されるため、完了まで待つ。
                event.preventDefault();
                event.stopPropagation();
                await logout();
                router.replace("/");
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link className="rounded border border-slate-200 px-3 py-1" href="/">
              Top
            </Link>
            <Link className="rounded border border-slate-200 px-3 py-1" href="/login">
              Login
            </Link>
          </>
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
