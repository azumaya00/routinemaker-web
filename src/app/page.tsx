"use client";

// ログイン前のファーストビュー。要件のコピーとCTAだけを置く。
// ログイン済みは /routines に寄せ、一覧や作成 UI はここに出さない。

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const router = useRouter();
  const { status, me } = useAuth();

  useEffect(() => {
    void me();
  }, [me]);

  // 認証済みはホームではなく /routines を入口にする。
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/routines");
    }
  }, [status, router]);

  // 認証状態の確定までは表示を出さず、ログイン直後のちらつきを防ぐ。
  if (status === "loading") {
    return null;
  }

  // 認証済みは遷移のみ行い、この画面は表示しない。
  if (status === "authenticated") {
    return null;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">
        今やる「ひとつ」だけに集中しよう
      </h1>
      <div className="text-sm text-slate-600">
        やることが多いと止まってしまう人のための、タスク管理アプリ
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="border border-slate-200 px-3 py-2 text-sm"
          onClick={() => router.push("/signup")}
        >
          無料で使う
        </button>
        <button
          type="button"
          className="border border-slate-200 px-3 py-2 text-sm"
          onClick={() => router.push("/login")}
        >
          Googleで続ける
        </button>
      </div>
    </section>
  );
}
