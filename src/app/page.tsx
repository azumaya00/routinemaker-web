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

  // トップページではbody、html、main、pb-20のdivなどすべての背景を完全に透明にする
  // 白い半透明の矩形を完全に削除: すべての背景関連プロパティを完全に透明に
  // トップページではスクロールを無効化: 1スクリーン完結のデザイン
  useEffect(() => {
    // bodyとhtmlにクラスを追加してCSSで制御
    document.documentElement.classList.add("top-page-active");
    document.body.classList.add("top-page-active");
    
    // bodyとhtmlの背景を完全に透明に（!important相当の確実な方法）
    document.documentElement.style.setProperty("background", "transparent", "important");
    document.documentElement.style.setProperty("background-color", "transparent", "important");
    document.documentElement.style.setProperty("background-image", "none", "important");
    document.documentElement.style.setProperty("backdrop-filter", "none", "important");
    // トップページではスクロールを無効化
    document.documentElement.style.setProperty("overflow", "hidden", "important");
    document.documentElement.style.setProperty("height", "100svh", "important");
    document.body.style.setProperty("background", "transparent", "important");
    document.body.style.setProperty("background-color", "transparent", "important");
    document.body.style.setProperty("background-image", "none", "important");
    document.body.style.setProperty("backdrop-filter", "none", "important");
    // トップページではスクロールを無効化
    document.body.style.setProperty("overflow", "hidden", "important");
    document.body.style.setProperty("height", "100svh", "important");
    
    // main要素の背景を完全に透明に、paddingを削除
    const mainElement = document.querySelector("main");
    if (mainElement) {
      const main = mainElement as HTMLElement;
      main.style.setProperty("background", "transparent", "important");
      main.style.setProperty("background-color", "transparent", "important");
      main.style.setProperty("background-image", "none", "important");
      main.style.setProperty("backdrop-filter", "none", "important");
      main.style.setProperty("box-shadow", "none", "important");
      main.style.setProperty("border", "none", "important");
      // トップページではmainの上下paddingを削除
      main.style.setProperty("padding-top", "0", "important");
      main.style.setProperty("padding-bottom", "0", "important");
    }
    
    // pb-20のdivの背景も完全に透明に、padding-bottomを削除
    const pb20Div = document.querySelector("main > div.pb-20");
    if (pb20Div) {
      const div = pb20Div as HTMLElement;
      div.style.setProperty("background", "transparent", "important");
      div.style.setProperty("background-color", "transparent", "important");
      div.style.setProperty("background-image", "none", "important");
      div.style.setProperty("backdrop-filter", "none", "important");
      div.style.setProperty("box-shadow", "none", "important");
      div.style.setProperty("border", "none", "important");
      // トップページではdiv.pb-20のpadding-bottomを削除
      div.style.setProperty("padding-bottom", "0", "important");
    }
    
    // .top-page-container、.top-page-content、.top-page-visualの背景も完全に透明に
    // 注意: .top-pageは背景画像を表示するための要素なので、背景を透明にしない
    
    const topPageContainer = document.querySelector(".top-page-container");
    if (topPageContainer) {
      const el = topPageContainer as HTMLElement;
      el.style.setProperty("background", "transparent", "important");
      el.style.setProperty("background-color", "transparent", "important");
      el.style.setProperty("background-image", "none", "important");
      el.style.setProperty("backdrop-filter", "none", "important");
      el.style.setProperty("box-shadow", "none", "important");
      el.style.setProperty("border", "none", "important");
    }
    
    const topPageContent = document.querySelector(".top-page-content");
    if (topPageContent) {
      const el = topPageContent as HTMLElement;
      el.style.setProperty("background", "transparent", "important");
      el.style.setProperty("background-color", "transparent", "important");
      el.style.setProperty("background-image", "none", "important");
      el.style.setProperty("backdrop-filter", "none", "important");
      el.style.setProperty("box-shadow", "none", "important");
      el.style.setProperty("border", "none", "important");
    }
    
    const topPageVisual = document.querySelector(".top-page-visual");
    if (topPageVisual) {
      const el = topPageVisual as HTMLElement;
      el.style.setProperty("background", "transparent", "important");
      el.style.setProperty("background-color", "transparent", "important");
      el.style.setProperty("background-image", "none", "important");
      el.style.setProperty("background-position", "unset", "important");
      el.style.setProperty("background-size", "unset", "important");
      el.style.setProperty("backdrop-filter", "none", "important");
      el.style.setProperty("box-shadow", "none", "important");
      el.style.setProperty("border", "none", "important");
    }
    
    return () => {
      // クリーンアップ: クラスとスタイルを削除
      document.documentElement.classList.remove("top-page-active");
      document.body.classList.remove("top-page-active");
      document.documentElement.style.removeProperty("background");
      document.documentElement.style.removeProperty("background-color");
      document.documentElement.style.removeProperty("background-image");
      document.documentElement.style.removeProperty("backdrop-filter");
      document.documentElement.style.removeProperty("overflow");
      document.documentElement.style.removeProperty("height");
      document.body.style.removeProperty("background");
      document.body.style.removeProperty("background-color");
      document.body.style.removeProperty("background-image");
      document.body.style.removeProperty("backdrop-filter");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("height");
      
      // クリーンアップ時にも要素を再取得する
      const mainElement = document.querySelector("main");
      if (mainElement) {
        const main = mainElement as HTMLElement;
        main.style.removeProperty("background");
        main.style.removeProperty("background-color");
        main.style.removeProperty("background-image");
        main.style.removeProperty("backdrop-filter");
        main.style.removeProperty("box-shadow");
        main.style.removeProperty("border");
        main.style.removeProperty("padding-top");
        main.style.removeProperty("padding-bottom");
      }
      
      const pb20Div = document.querySelector("main > div.pb-20");
      if (pb20Div) {
        const div = pb20Div as HTMLElement;
        div.style.removeProperty("background");
        div.style.removeProperty("background-color");
        div.style.removeProperty("background-image");
        div.style.removeProperty("backdrop-filter");
        div.style.removeProperty("box-shadow");
        div.style.removeProperty("border");
        div.style.removeProperty("padding-bottom");
      }
      
      // 注意: .top-pageは背景画像を表示するための要素なので、クリーンアップしない
      const topPageContainer = document.querySelector(".top-page-container");
      if (topPageContainer) {
        const el = topPageContainer as HTMLElement;
        el.style.removeProperty("background");
        el.style.removeProperty("background-color");
        el.style.removeProperty("background-image");
        el.style.removeProperty("backdrop-filter");
        el.style.removeProperty("box-shadow");
        el.style.removeProperty("border");
      }
      
      const topPageContent = document.querySelector(".top-page-content");
      if (topPageContent) {
        const el = topPageContent as HTMLElement;
        el.style.removeProperty("background");
        el.style.removeProperty("background-color");
        el.style.removeProperty("background-image");
        el.style.removeProperty("backdrop-filter");
        el.style.removeProperty("box-shadow");
        el.style.removeProperty("border");
      }
      
      const topPageVisual = document.querySelector(".top-page-visual");
      if (topPageVisual) {
        const el = topPageVisual as HTMLElement;
        el.style.removeProperty("background");
        el.style.removeProperty("background-color");
        el.style.removeProperty("background-image");
        el.style.removeProperty("background-position");
        el.style.removeProperty("background-size");
        el.style.removeProperty("backdrop-filter");
        el.style.removeProperty("box-shadow");
        el.style.removeProperty("border");
      }
    };
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
