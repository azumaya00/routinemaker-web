"use client";

// 実行中画面。ここでは「今やる1つ」だけを表示し、完了を最優先にする。
// historyId をキーにセッション内のタスクを参照し、API とは履歴完了/中断のみ連携する。

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { abortHistory, completeHistory, getCsrfCookie } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

type RunPayload = {
  title: string;
  tasks: string[];
};

export default function RunPage() {
  const router = useRouter();
  const params = useParams<{ historyId: string }>();
  const { status, me } = useAuth();
  const [payload, setPayload] = useState<RunPayload | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const historyId = Number(params?.historyId);

  const currentTask = useMemo(() => {
    if (!payload || payload.tasks.length === 0) {
      return null;
    }
    return payload.tasks[currentIndex] ?? null;
  }, [payload, currentIndex]);

  // 認証判定は /api/me の成否のみで統一する。
  useEffect(() => {
    void me();
  }, [me]);

  // 未認証の遷移はガード側で統一する。

  // 実行中は API から再取得せず、開始時に保存したタスクを使う。
  useEffect(() => {
    if (!historyId || Number.isNaN(historyId)) {
      setError("履歴IDが不正です。");
      return;
    }

    const raw = sessionStorage.getItem(`run:${historyId}`);
    if (!raw) {
      setError("実行情報が見つかりません。");
      return;
    }

    try {
      setPayload(JSON.parse(raw) as RunPayload);
    } catch {
      setError("実行情報の読み込みに失敗しました。");
    }
  }, [historyId]);

  const handleComplete = async () => {
    if (!payload) {
      return;
    }

    const isLast = currentIndex >= payload.tasks.length - 1;
    if (!isLast) {
      // 途中はローカル state のみ進め、API は最後に確定させる。
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    if (!historyId || Number.isNaN(historyId)) {
      setError("履歴IDが不正です。");
      return;
    }

    setError(null);
    await getCsrfCookie();
    const result = await completeHistory(historyId);
    if (result.status === 200) {
      router.push(`/run/${historyId}/done`);
      return;
    }

    setError(`完了に失敗しました (${result.status})`);
  };

  const handleAbort = async () => {
    if (!historyId || Number.isNaN(historyId)) {
      setError("履歴IDが不正です。");
      return;
    }

    // 中断は完了画面に行かず、ホームへ戻す方針。
    setError(null);
    await getCsrfCookie();
    const result = await abortHistory(historyId);
    if (result.status === 200) {
      router.push("/routines");
      return;
    }

    setError(`中断に失敗しました (${result.status})`);
  };

  if (status === "loading") {
    return <div className="text-sm text-slate-600">Loading...</div>;
  }

  if (error) {
    return <div className="text-sm text-slate-600">{error}</div>;
  }

  if (!payload) {
    return <div className="text-sm text-slate-600">Loading...</div>;
  }

  return (
    <section className="space-y-6">
      {/* 実行中は「今やる1つ」を最優先に視認させる。 */}
      <div className="text-4xl font-semibold">{currentTask ?? "-"}</div>
      <button
        type="button"
        // 完了ボタンを最優先にするため、サイズと面積を大きく取る。
        className="bg-slate-900 px-6 py-4 text-base text-white"
        onClick={handleComplete}
      >
        完了
      </button>
      <div className="pt-6">
        <button
          type="button"
          // 中断は控えめに配置し、誤操作の優先度を下げる。
          className="border border-slate-200 px-3 py-2 text-xs text-slate-600"
          onClick={handleAbort}
        >
          中断
        </button>
      </div>
    </section>
  );
}
