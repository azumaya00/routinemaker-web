"use client";

// 実行中画面。ここでは「今やる1つ」だけを表示し、完了を最優先にする。
// historyId をキーにセッション内のタスクを参照し、API とは履歴完了/中断のみ連携する。

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { abortHistory, completeHistory, getCsrfCookie } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";

type RunPayload = {
  title: string;
  tasks: string[];
  started_at?: string | null;
  task_estimates?: number[] | null;
};

export default function RunPage() {
  const router = useRouter();
  const params = useParams<{ historyId: string }>();
  const { status, me, settings } = useAuth();
  const [payload, setPayload] = useState<RunPayload | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  const historyId = Number(params?.historyId);

  const currentTask = useMemo(() => {
    if (!payload || payload.tasks.length === 0) {
      return null;
    }
    return payload.tasks[currentIndex] ?? null;
  }, [payload, currentIndex]);

  const remainingCount = useMemo(() => {
    if (!payload) {
      return 0;
    }
    return Math.max(payload.tasks.length - currentIndex - 1, 0);
  }, [payload, currentIndex]);

  // 目安時間機能は仕様から削除（コードは残すが使用しない）

  // 経過時間を計算（設定されている場合のみ）
  // 注意: Hooksの順序を固定するため、早期リターンの前に配置
  const elapsedMinutes = useMemo(() => {
    if (
      !settings?.show_elapsed_time ||
      !payload?.started_at ||
      !now ||
      Number.isNaN(new Date(payload.started_at).getTime())
    ) {
      return null;
    }
    return Math.max(
      Math.floor(
        (now.getTime() - new Date(payload.started_at).getTime()) / 60000
      ),
      0
    );
  }, [settings?.show_elapsed_time, payload?.started_at, now]);

  // 補助情報を1行で表示（「残り◯ / 経過◯分」形式）
  // 注意: Hooksの順序を固定するため、早期リターンの前に配置
  const statusInfo = useMemo(() => {
    const parts: string[] = [];
    if (settings?.show_remaining_tasks) {
      parts.push(`残り ${remainingCount}`);
    }
    if (elapsedMinutes !== null) {
      parts.push(`経過 ${elapsedMinutes}分`);
    }
    return parts.length > 0 ? parts.join(" / ") : null;
  }, [settings?.show_remaining_tasks, remainingCount, elapsedMinutes]);

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

  // 経過時間は分単位で良いので、軽い間隔で現在時刻を更新する。
  useEffect(() => {
    if (!settings?.show_elapsed_time) {
      setNow(null);
      return;
    }
    setNow(new Date());
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => window.clearInterval(id);
  }, [settings?.show_elapsed_time]);

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

    // 最後のタスク完了時: ユーザー操作コンテキスト内で効果音を開始
    // 方針1を採用: 完了ボタン押下時のユーザー操作コンテキストで音再生を開始し、画面遷移後も継続
    // 理由: ブラウザの自動再生ポリシーにより、ユーザー操作のコンテキスト内で開始する必要がある
    let celebrationAudio: HTMLAudioElement | null = null;
    if (settings?.show_celebration) {
      try {
        celebrationAudio = new Audio("/sounds/confetti.mp3");
        celebrationAudio.volume = 0.5; // 音量を控えめに
        celebrationAudio.preload = "auto"; // 事前読み込みを有効化
        
        // 音声ファイルの読み込み完了を待つ（最初の破裂音が聞こえるように）
        await new Promise<void>((resolve, reject) => {
          if (celebrationAudio) {
            celebrationAudio.addEventListener("canplaythrough", () => {
              // 読み込み完了後、再生位置を先頭にリセット
              celebrationAudio!.currentTime = 0;
              resolve();
            }, { once: true });
            
            celebrationAudio.addEventListener("error", (err) => {
              reject(err);
            }, { once: true });
            
            // 読み込みを開始
            celebrationAudio.load();
          } else {
            reject(new Error("Audio element not created"));
          }
        });
        
        // ユーザー操作コンテキスト内で再生を開始（画面遷移後も継続する）
        await celebrationAudio.play();
        // sessionStorageに再生中の音声を保存（完了画面で継続させるため）
        sessionStorage.setItem(`celebration_audio_${historyId}`, "playing");
      } catch (err) {
        // 再生失敗は無視（UIは壊さない）
        console.warn("Sound playback failed:", err);
      }
    }

    setError(null);
    await getCsrfCookie();
    const result = await completeHistory(historyId);
    if (result.status === 200) {
      // 音声が再生中の場合は、完了画面でも継続させるためsessionStorageに保存
      if (celebrationAudio) {
        // 音声オブジェクトをグローバルに保存（完了画面で参照できるように）
        (window as unknown as Record<string, unknown>)[`celebration_audio_${historyId}`] = celebrationAudio;
      }
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
    return <LoadingSpinner />;
  }

  if (error) {
    return <div className="rm-muted text-sm">{error}</div>;
  }

  if (!payload) {
    return <LoadingSpinner />;
  }

  return (
    <section className="run-page-container">
      {/* 実行中は「今やる1つ」を最優先に視認させる。中央寄せ、余白多め */}
      <div className="run-page-content">
        {/* タスク名: 大きく、中央寄せ */}
        <h1 className="run-page-task-name">{currentTask ?? "-"}</h1>

        {/* 補助情報: 「残り◯ / 経過◯分」形式で1行表示（設定されている場合のみ） */}
        {statusInfo ? (
          <div className="run-page-status">{statusInfo}</div>
        ) : null}

        {/* 完了ボタン: 丸型の主ボタン（この画面専用スタイル） */}
        <button
          type="button"
          className="run-page-complete-btn"
          onClick={handleComplete}
        >
          できた！
        </button>

        {/* 中断: リンク風、距離で弱める（A案） */}
        <button
          type="button"
          className="run-page-abort-btn"
          onClick={handleAbort}
        >
          中断する
        </button>
      </div>
    </section>
  );
}
