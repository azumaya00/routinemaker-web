// 画面全体の枠を統一するための最小レイアウト定義。
import type { Metadata } from "next";
import { Josefin_Sans, Noto_Sans_JP } from "next/font/google";

import { AppShell } from "@/components/AppShell";
import { FlashMessageProvider } from "@/components/FlashMessageProvider";
import "./globals.css";

// ロゴ用フォント: Josefin Sans（ヘッダーのサービス名に使用）
const josefinSans = Josefin_Sans({
  variable: "--font-logo",
  subsets: ["latin"],
  weight: ["400", "500", "600"], // ロゴ用に複数のウェイトを読み込み
});

// 本文用フォント: Noto Sans JP（日本語可読性重視）
const notoSansJP = Noto_Sans_JP({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "RoutineMaker",
  description: "RoutineMaker は「今やるひとつ」に集中するためのタスク管理アプリです。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <meta httpEquiv="content-language" content="ja" />
        <meta name="language" content="ja" />
        {/* SSR/CSRのちらつき対策: テーマとダークモードの初期値を注入 */}
        {/* このscriptはHTMLのhead内で実行され、Reactのhydration前にテーマを適用する */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // localStorageから設定を取得（認証済みユーザーの場合）
                  // 注意: 未認証時はデフォルト（light、system）を使用
                  var theme = 'light';
                  var darkMode = 'system';
                  
                  // サーバーサイドではlocalStorageにアクセスできないため、
                  // クライアントサイドでのみ実行される
                  if (typeof window !== 'undefined') {
                    // 実際の設定はAppShellのuseEffectで適用されるが、
                    // 初期レンダリング時のちらつきを防ぐため、ここではデフォルトを設定
                    // 認証済みユーザーの設定はAppShellで上書きされる
                  }
                  
                  // システム設定に基づいて初期ダークモードを適用
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (prefersDark && darkMode === 'system') {
                    document.documentElement.classList.add('dark');
                  } else if (darkMode === 'on') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {
                  // エラーは無視（デフォルト設定を使用）
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${josefinSans.variable} ${notoSansJP.variable} antialiased`}
      >
        <FlashMessageProvider>
          <AppShell>{children}</AppShell>
        </FlashMessageProvider>
      </body>
    </html>
  );
}
