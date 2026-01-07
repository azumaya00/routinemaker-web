"use client";

// 完了後画面。余韻を邪魔しない最小表示で /routines へ戻すだけにする。

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";

export default function RunDonePage() {
  const router = useRouter();
  const { me } = useAuth();

  // 完了画面も認証ガードの方針を揃える。
  useEffect(() => {
    void me();
  }, [me]);

  // 未認証の遷移はガードに統一する。

  return (
    <section className="space-y-4">
      <div className="text-sm text-slate-600">完了しました。</div>
      <button
        type="button"
        className="border border-slate-200 px-3 py-2 text-sm"
        onClick={() => router.push("/routines")}
      >
        ホームに戻る
      </button>
    </section>
  );
}
