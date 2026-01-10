"use client";

/**
 * AppShell: アプリ全体の共通レイアウト構造テンプレート
 * 
 * 責務：
 * - 全ページ共通のレイアウト構造（Header / Main / Footer）を提供
 * - 認証状態に応じた表示制御（フッターの表示/非表示）
 * - 各page.tsxは「Mainに表示する中身のみ」を返す前提
 * 
 * 構造：
 * - Header: 常に表示（画面上部に固定）
 * - Main: 各ページのコンテンツを表示（flex-1で残りスペースを占有）
 * - Footer: 非ログイン時のみ表示（画面下部に固定）
 * 
 * レイアウト方式：
 * - flex-colで縦レイアウトを保証
 * - HeaderとFooterは固定、Mainは可変
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { checkHealth } from "@/lib/api";

/**
 * Header: アプリ共通ヘッダー
 * 
 * 責務：
 * - アプリ名とメニューボタンの表示
 * - 認証状態に応じたメニュー項目の出し分け
 * - 認証ガード（未ログイン時のprotectedページへのアクセス制御）
 * - テーマ設定の適用
 * 
 * レイアウト：
 * - 画面上部に固定（pt-0で上端に張り付け）
 * - 全幅表示、内部コンテンツは中央揃え（max-w-3xl）
 */
const Header = () => {
  const { status, logout, me, isLoggingOut, finishLogout, settings } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false); // 閉じるアニメーション中かどうか
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
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

  // テーマは data-theme に反映し、CSS 変数の切り替えに繋げる。
  // 未認証時は常にデフォルトテーマ（light）を強制し、ログアウト後もテーマが残らないようにする。
  useEffect(() => {
    const root = document.documentElement;
    
    // 未認証時は常にデフォルトテーマ（light）を強制
    if (status !== "authenticated" || !settings) {
      // ログアウト時や未認証時は data-theme を削除（デフォルトの :root が適用される）
      delete root.dataset.theme;
      return;
    }
    
    // 認証済み時のみ、設定されたテーマを適用
    root.dataset.theme = settings.theme;
  }, [status, settings]);

  // ダークモードは class を切り替え、Tailwind の dark 戦略と合わせる。
  useEffect(() => {
    if (!settings) {
      return;
    }

    const root = document.documentElement;
    const apply = (isDark: boolean) => {
      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    if (settings.dark_mode === "on") {
      apply(true);
      return;
    }

    if (settings.dark_mode === "off") {
      apply(false);
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    apply(media.matches);
    const handler = (event: MediaQueryListEvent) => apply(event.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [settings]);

  // メニューを閉じる処理: 閉じるアニメーションを適用
  const closeMenu = useCallback(() => {
    setIsClosing(true);
    // アニメーション完了後にメニューを非表示にする
    setTimeout(() => {
      setMenuOpen(false);
      setIsClosing(false);
    }, 300); // slideOutRightアニメーションの時間（0.3s）に合わせる
  }, []);

  // ハンバーガーボタンのクリック処理
  const toggleMenu = () => {
    if (menuOpen) {
      closeMenu();
    } else {
      setMenuOpen(true);
      setIsClosing(false);
    }
  };

  // メニューの開閉処理: ESCキー、オーバーレイクリック、スクロールロック
  useEffect(() => {
    if (!menuOpen) {
      // メニューが閉じている時はスクロールロックを解除
      if (!isClosing) {
        document.body.style.overflow = "";
      }
      return;
    }

    // スクロールロック: メニューOPEN中はbodyスクロールしない
    document.body.style.overflow = "hidden";

    // ESCキーで閉じる
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    // フォーカスをドロワー内に移す
    const firstFocusable = drawerRef.current?.querySelector<HTMLElement>(
      'a, button, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    // クリーンアップ時に使用するrefをコピー
    const buttonRef = menuButtonRef.current;

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
      // 閉じたらボタンにフォーカスを戻す
      if (buttonRef) {
        buttonRef.focus();
      }
    };
  }, [menuOpen, isClosing, closeMenu]);

  // トップページではヘッダーを透明にする
  const isTopPage = pathname === "/";
  
  return (
    <header
      className={`relative py-3 md:py-4 w-full m-0 z-50 ${isTopPage ? "border-0" : "rm-border border-b"}`}
      style={{ 
        background: isTopPage ? "transparent" : "var(--muted)",
        /* トップページでは完全に透明、ボーダーも削除 */
        borderBottom: isTopPage ? "none" : undefined,
        /* 確実に透明にするため、背景色を明示的に設定 */
        backgroundColor: isTopPage ? "transparent" : undefined
      }}
    >
      {/* 
        ヘッダー: 背景は全幅、コンテナで中身を制限
        - コンテナ: max-w-6xl（1152px）、px-6 md:px-10 lg:px-12
        - 縦padding: py-3（base）、md:py-4
      */}
      <div className="mx-auto w-full max-w-6xl flex items-center justify-between px-6 md:px-10 lg:px-12">
        {/* 
          アプリ名をクリック可能にする
          ログイン状態に応じて遷移先を変更:
          - 未ログイン: / (トップページ)
          - ログイン済み: /routines (ログイン後の最初の画面)
        */}
        {/* 
          ロゴ: brand-logoクラスでスタイル適用
          ログイン状態に応じて遷移先を変更
        */}
        <Link
          href={status === "authenticated" ? "/routines" : "/"}
          className="brand-logo cursor-pointer no-underline flex-shrink-0"
          style={{ marginLeft: "12px" }} /* 左側に12pxの余白を追加 */
        >
          RoutineMaker
        </Link>
        {/* ハンバーガーメニューボタン: アクセシビリティ対応、アイコンのみ表示（枠線なし、青系色）、32px四方 */}
        <button
          ref={menuButtonRef}
          type="button"
          className="flex items-center justify-center flex-shrink-0 w-8 h-8 hover:opacity-70 transition-opacity bg-transparent border-none outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          onClick={toggleMenu}
          aria-label="メニュー"
          aria-expanded={menuOpen}
          aria-controls="menu-drawer"
          style={{ 
            minWidth: "32px", 
            minHeight: "32px",
            // iOS Safari で currentColor が抜けないケースを避けるため色を明示
            color: isTopPage ? "var(--accent)" : "var(--fg)", // トップはアクセント系、その他は通常の前景色
            marginRight: "12px" // 右側に12pxの余白を追加
          }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke={isTopPage ? "var(--accent)" : "var(--fg)"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ padding: 0 }}
          >
            {menuOpen ? (
              // 閉じるアイコン（X）
              <>
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </>
            ) : (
              // ハンバーガーアイコン
              <>
                <path d="M3 6h18" />
                <path d="M3 12h18" />
                <path d="M3 18h18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* ドロワーメニュー: オーバーレイ＋右からスライド（開く時も閉じる時もアニメーション） */}
      {(menuOpen || isClosing) && (
        <>
          {/* オーバーレイ: 背景を薄く暗く、クリックで閉じる */}
          <div
            className={`menu-overlay ${isClosing ? "menu-overlay-closing" : ""}`}
            onClick={closeMenu}
            aria-hidden="true"
          />

          {/* ドロワー: 右からスライド（閉じる時もアニメーション） */}
          <div
            ref={drawerRef}
            id="menu-drawer"
            className={`menu-drawer ${isClosing ? "menu-drawer-closing" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="メニュー"
          >
            {/* ドロワーヘッダー: 閉じるボタン */}
            <div className="menu-drawer-header">
              <span style={{ fontWeight: 600, fontSize: "18px" }}>メニュー</span>
              <button
                type="button"
                className="menu-drawer-close"
                onClick={closeMenu}
                aria-label="メニューを閉じる"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  style={{ width: "24px", height: "24px" }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* メニュー項目 */}
            <div className="menu-drawer-content">
              {status === "authenticated" ? (
                // ログイン後のメニュー項目
                <>
                  <Link
                    href="/routines"
                    className="menu-item"
                    onClick={closeMenu}
                  >
                    ホーム
                  </Link>
                  <Link
                    href="/histories"
                    className="menu-item"
                    onClick={closeMenu}
                  >
                    履歴
                  </Link>
                  <Link
                    href="/settings"
                    className="menu-item"
                    onClick={closeMenu}
                  >
                    設定
                  </Link>
                  <button
                    type="button"
                    className="menu-item menu-item-danger"
                    onClick={async () => {
                      closeMenu();
                      await logout();
                      router.replace("/");
                    }}
                  >
                    ログアウト
                  </button>
                </>
              ) : (
                // 未ログイン時のメニュー項目
                <>
                  <Link
                    href="/"
                    className="menu-item"
                    onClick={closeMenu}
                  >
                    トップ
                  </Link>
                  <Link
                    href="/login"
                    className="menu-item"
                    onClick={closeMenu}
                  >
                    ログイン
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
};

/**
 * Footer: 非ログイン領域専用フッター
 * 
 * 責務：
 * - 非ログイン時のみ表示（認証済み時は非表示）
 * - 公開ページ（/, /login, /signup等）でのみ表示
 * 
 * レイアウト：
 * - 画面下部に固定（fixed bottom-0）
 * - 全幅表示、内部コンテンツは中央揃え（max-w-3xl）
 * - Headerと重ならないよう、z-indexで制御（z-40）
 * 
 * 注意：
 * - Mainコンテンツがフッターに隠れないよう、非ログイン時はMainにpb-20を設定
 */
const PublicFooter = () => {
  const { status } = useAuth();
  const pathname = usePathname();
  const publicPaths = useMemo(
    () => ["/", "/login", "/signup", "/forgot-password", "/reset-password"],
    []
  );

  // 非ログインエリアでのみフッターを表示
  // 条件: 認証済みでない（loading/unauthenticated）かつ公開ページである
  const shouldShowFooter = status !== "authenticated" && publicPaths.includes(pathname);
  
  if (!shouldShowFooter) {
    return null;
  }
  
  const year = new Date().getFullYear();
  // トップページではフッターを透明にする
  const isTopPage = pathname === "/";
  
  return (
    <footer
      className={`fixed bottom-0 left-0 right-0 z-40 text-center w-full ${isTopPage ? "border-0" : "rm-border border-t"}`}
      style={{ 
        background: isTopPage ? "transparent" : "var(--muted)", 
        margin: 0,
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        fontSize: "0.75rem", // 12px: フォントサイズ
        paddingTop: "0.25rem", // 4px: 上パディング
        paddingBottom: "0.25rem", // 4px: 下パディング
        color: isTopPage ? "rgba(74, 111, 165, 0.7)" : "var(--fg)", // トップページでは薄い青系
        borderTop: isTopPage ? "none" : undefined // トップページではボーダーを削除
      }}
    >
      {/* 
        フッターをブラウザ下部に固定（fixed positioning）
        全幅にして左右の余白を削除
        内部コンテンツだけを中央揃えにしてmainと幅を統一
        フォントサイズ: 12px（0.75rem）
        上下パディング: 各4px（0.25rem）で合計高さ20px（12px + 4px + 4px）
      */}
      {/* フッター: 背景は全幅、コンテナで中身を制限（ヘッダーと同じ基準） */}
      <div className="mx-auto w-full max-w-6xl px-6 md:px-10 lg:px-12">
        ©Copyright {year} RoutineMaker.All Rights Reserved
      </div>
    </footer>
  );
};

/**
 * AppShell: 共通レイアウト構造テンプレート
 * 
 * 構造：
 * ┌─────────────────────┐
 * │      Header         │ ← 常に表示（画面上部固定）
 * ├─────────────────────┤
 * │                     │
 * │       Main          │ ← 各page.tsxのコンテンツ（flex-1で可変）
 * │    (children)       │
 * │                     │
 * ├─────────────────────┤
 * │      Footer         │ ← 非ログイン時のみ表示（画面下部固定）
 * └─────────────────────┘
 * 
 * レイアウト責務：
 * - flex-col: 縦レイアウトを保証
 * - min-h-screen: 画面高さを最低限確保
 * - Header: 上端に張り付け（pt-0）
 * - Main: flex-1で残りスペースを占有、中央揃え（max-w-3xl）
 * - Footer: 下端に固定（fixed bottom-0）、非ログイン時のみ表示
 * 
 * 各page.tsxの責務：
 * - Mainに表示するコンテンツのみを返す（<section>等でラップ）
 * - レイアウト構造（Header/Footer）は考慮不要
 * - フッター分の余白（pb-20）はAppShell側で制御
 * 
 * 表示パターン：
 * - 非ログインエリア: Header + Main + Footer
 * - ログインエリア: Header + Main（Footerなし）
 * 
 * 背景色の統一：
 * - ログイン後の画面は全て同じ背景色（--app-bg）を適用
 * - Main領域に認証状態に応じた背景色を設定
 */
const AppShellContent = ({ children }: { children: React.ReactNode }) => {
  const { status } = useAuth();
  const pathname = usePathname();
  const publicPaths = useMemo(
    () => ["/", "/login", "/signup", "/forgot-password", "/reset-password"],
    []
  );
  const protectedPrefixes = useMemo(
    () => ["/routines", "/run", "/histories", "/settings"],
    []
  );

  // アプリ起動時に API 疎通確認を実行（本番デプロイ時の確認用）
  useEffect(() => {
    void checkHealth();
  }, []);

  // 開発時のみ、横幅オーバー要素に data-overflow を付与して可視化（本番では無効）
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
      return;
    }

    const reportOverflow = () => {
      document.documentElement.dataset.debugOverflow = "1";
      document
        .querySelectorAll<HTMLElement>("[data-overflow]")
        .forEach((el) => el.removeAttribute("data-overflow"));

      const offenders = Array.from(
        document.querySelectorAll<HTMLElement>("*")
      ).filter((el) => el.scrollWidth > el.clientWidth + 1);

      offenders.slice(0, 120).forEach((el) => {
        el.setAttribute("data-overflow", "1");
      });
    };

    reportOverflow();
    window.addEventListener("resize", reportOverflow);
    return () => {
      window.removeEventListener("resize", reportOverflow);
      document.documentElement.removeAttribute("data-debug-overflow");
      document
        .querySelectorAll<HTMLElement>("[data-overflow]")
        .forEach((el) => el.removeAttribute("data-overflow"));
    };
  }, [pathname]);

  // ログイン後の画面かどうかを判定
  const isAuthenticatedPage = status === "authenticated" && 
    protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  return (
    <div className="flex min-h-screen flex-col m-0">
      {/* Header: 常に表示、画面上部に固定、shrink-0で縮小を防ぐ */}
      <div className="shrink-0">
        <Header />
      </div>
      
      {/* Main: 各ページのコンテンツを表示する領域、flex-1で残りスペースを占有 */}
      {/* ログイン後の画面には統一背景色（--app-bg）を適用 */}
      <main 
        className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 md:px-10 lg:px-12"
        style={{
          backgroundColor: isAuthenticatedPage ? "var(--app-bg)" : undefined,
        }}
      >
        {/* 
          非ログイン時はフッター分の余白を追加（pb-20）
          ログイン時はフッターが表示されないため、通常の余白のみ
          各page.tsxはこの中にコンテンツを返す前提
        */}
        <div className="pb-20">
          {children}
        </div>
      </main>
      
      {/* Footer: 非ログイン時のみ表示、画面下部に固定、shrink-0で縮小を防ぐ */}
      <div className="shrink-0">
        <PublicFooter />
      </div>
    </div>
  );
};

export const AppShell = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <AppShellContent>{children}</AppShellContent>
  </AuthProvider>
);
