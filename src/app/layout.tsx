// 画面全体の枠を統一するための最小レイアウト定義。
import type { Metadata } from "next";
import { Josefin_Sans, Noto_Sans_JP } from "next/font/google";

import { AppShell } from "@/components/AppShell";
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
  description: "Minimal auth scaffolding for RoutineMaker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${josefinSans.variable} ${notoSansJP.variable} antialiased`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
