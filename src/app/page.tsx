"use client";

/**
 * ホームページ（非ログイン時）
 * 
 * 責務：
 * - ログイン前のファーストビューを表示（1スクリーン完結）
 * - 青系固定デザイン（テーマ切替の影響を受けない）
 * - ログイン済みの場合は /routines にリダイレクト
 * 
 * レイアウト：
 * - 左側: コピーとCTA
 * - 右側: 抽象的なビジュアル領域
 * - モバイル: 縦積みレイアウト
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";

export default function Home() {
  const router = useRouter();
  const { status, me } = useAuth();

  useEffect(() => {
    void me();
  }, [me]);

  // 認証済みはホームではなく /routines を入口にする
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/routines");
    }
  }, [status, router]);

  // 過去に付与していたトップページ専用クラス・スクロールロックを撤去し、通常スクロールを許可する
  useEffect(() => {
    document.documentElement.classList.remove("top-page-active");
    document.body.classList.remove("top-page-active");
    document.documentElement.style.removeProperty("overflow");
    document.documentElement.style.removeProperty("height");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("height");

    return () => {
      document.documentElement.classList.remove("top-page-active");
      document.body.classList.remove("top-page-active");
      document.documentElement.style.removeProperty("overflow");
      document.documentElement.style.removeProperty("height");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("height");
    };
  }, []);

  // 開発時のみ、横幅オーバー要素を特定するデバッグログを出力
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
      return;
    }

    const reportOverflow = () => {
      const offenders = Array.from(document.querySelectorAll<HTMLElement>("*"))
        .map((el) => {
          const scrollWidth = el.scrollWidth;
          const clientWidth = el.clientWidth;
          if (scrollWidth > clientWidth + 1) {
            return {
              tag: el.tagName,
              id: el.id || "",
              className: (typeof el.className === "string" ? el.className : "").slice(0, 120),
              scrollWidth,
              clientWidth,
            };
          }
          return null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .slice(0, 30);

      if (offenders.length > 0) {
        // eslint-disable-next-line no-console
        console.table(offenders);
      }
    };

    reportOverflow();
    window.addEventListener("resize", reportOverflow);
    return () => window.removeEventListener("resize", reportOverflow);
  }, []);

  // 認証状態の確定までは表示を出さず、ログイン直後のちらつきを防ぐ
  if (status === "loading") {
    return null;
  }

  // 認証済みは遷移のみ行い、この画面は表示しない
  if (status === "authenticated") {
    return null;
  }

  return (
    <>
      {/* TOPページの背景画像: ブラウザ全体を覆う */}
      <div className="top-page" aria-hidden="true" />
      
      {/* TOPページのコンテンツ: 背景画像の上に表示 */}
      <div className="top-page-content-wrapper">
        {/* メインコンテンツ: 左側にコピーとCTA、右側にビジュアル */}
        <div className="top-page-container">
          {/* 左側: コピーとCTA */}
          <div className="top-page-content">
            <h1 className="top-page-heading">
              今やる「ひとつ」<br className="top-page-heading-br-mobile" />
              <span className="top-page-heading-text-pc">だけに</span>
              <br className="top-page-heading-br-pc" />
              <span className="top-page-heading-text-mobile">だけに</span>集中しよう
            </h1>
            <p className="top-page-subheading">
              やることが多いと<br className="top-page-subheading-br-mobile" />
              <span className="top-page-subheading-text-pc">止まってしまう人のための</span>
              <span className="top-page-subheading-text-mobile">止まってしまう人のための<br className="top-page-subheading-br-mobile-2" /></span>
              <br className="top-page-subheading-br-pc" />
              タスク管理アプリ
            </p>
            <div className="top-page-cta">
              <button
                type="button"
                className="top-page-btn-primary"
                onClick={() => router.push("/signup")}
              >
                無料で使う
              </button>
              {/* Google 公式準拠ボタンで OAuth へ遷移 */}
              <GoogleLoginButton />
            </div>
          </div>

          {/* 右側: 抽象的なビジュアル領域 */}
          <div className="top-page-visual" aria-hidden="true">
            <div className="top-page-shape top-page-shape-1"></div>
            <div className="top-page-shape top-page-shape-2"></div>
            <div className="top-page-shape top-page-shape-3"></div>
            <div className="top-page-shape top-page-shape-4"></div>
            <div className="top-page-shape top-page-shape-5"></div>
          </div>
        </div>
      </div>
    </>
  );
}
