/**
 * パスワード再設定画面（Server Component）
 * 
 * 責務：
 * - useSearchParams を使う Client Component を Suspense で包む
 * - ビルド時の prerender エラーを防ぐ
 */

import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ResetPasswordClient />
    </Suspense>
  );
}
