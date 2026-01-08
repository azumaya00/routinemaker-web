"use client";

// 完了後画面。参考画像に合わせた実装。
// チェックアイコン、メッセージ、リスト名、ホームへ戻るボタンを表示。
// 設定で「完了演出」がONの場合のみ、confettiと効果音を再生。

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import confetti from "canvas-confetti";

import { useAuth } from "@/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";

type RunPayload = {
  title: string;
  tasks: string[];
  started_at?: string | null;
  task_estimates?: number[] | null;
};

export default function RunDonePage() {
  const router = useRouter();
  const params = useParams<{ historyId: string }>();
  const { status, me, settings } = useAuth();
  const [payload, setPayload] = useState<RunPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasPlayedCelebration = useRef(false); // 演出を1回だけ実行するためのフラグ

  const historyId = params?.historyId ? String(params.historyId) : null;

  // 完了画面も認証ガードの方針を揃える。
  useEffect(() => {
    void me();
  }, [me]);

  // 未認証の遷移はガードに統一する。

  // 実行時のタスク情報をsessionStorageから取得（リスト名表示用）
  useEffect(() => {
    if (!historyId) {
      setError("履歴IDが不正です。");
      return;
    }

    const raw = sessionStorage.getItem(`run:${historyId}`);
    if (!raw) {
      // sessionStorageにない場合はエラーにせず、リスト名を表示しない
      return;
    }

    try {
      setPayload(JSON.parse(raw) as RunPayload);
    } catch {
      // パースエラーは無視（リスト名を表示しないだけ）
    }
  }, [historyId]);

  // 完了演出: 設定がONの場合のみ、confettiと効果音を再生
  // 方針1を採用: 実行中画面の「完了」ボタン押下時に効果音を開始し、完了画面でも継続
  // 理由: ブラウザの自動再生ポリシーにより、ユーザー操作のコンテキスト内で開始する必要がある
  // 実行中画面で開始した音声は、画面遷移後も継続する
  useEffect(() => {
    // 演出は1回だけ実行
    if (hasPlayedCelebration.current) {
      return;
    }

    // 設定がOFFの場合は何もしない
    if (!settings?.show_celebration) {
      return;
    }

    // 設定がONの場合のみ演出を実行
    hasPlayedCelebration.current = true;

    // confettiアニメーション
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"], // カラフルな紙吹雪
      });
    } catch (err) {
      // confettiのエラーは無視（UIは壊さない）
      console.warn("Confetti animation failed:", err);
    }

    // 効果音: 実行中画面で開始された音声を継続させる
    // 実行中画面で開始されていない場合（直接アクセスなど）は、ここで再生を試みる
    if (historyId) {
      const existingAudio = (window as unknown as Record<string, unknown>)[`celebration_audio_${historyId}`] as HTMLAudioElement | undefined;
      if (existingAudio) {
        // 実行中画面で開始された音声が既にある場合は、そのまま継続させる
        // 音声が途中で止まっている場合は再開を試みる
        if (existingAudio.paused) {
          // 再生位置を先頭にリセットしてから再生（最初の破裂音が聞こえるように）
          existingAudio.currentTime = 0;
          void existingAudio.play().catch((err) => {
            console.warn("Sound resume failed:", err);
          });
        }
      } else {
        // 実行中画面で開始されていない場合は、ここで再生を試みる（フォールバック）
        try {
          const audio = new Audio("/sounds/confetti.mp3");
          audio.volume = 0.5;
          audio.preload = "auto";
          
          // 音声ファイルの読み込み完了を待つ
          audio.addEventListener("canplaythrough", () => {
            audio.currentTime = 0; // 再生位置を先頭にリセット
            void audio.play().catch((err) => {
              console.warn("Sound playback failed (browser restriction):", err);
            });
          }, { once: true });
          
          audio.load(); // 読み込みを開始
        } catch (err) {
          console.warn("Sound file load failed:", err);
        }
      }
    }
  }, [settings?.show_celebration, historyId]);

  if (status === "loading") {
    return <LoadingSpinner />;
  }

  if (error) {
    return <div className="rm-muted text-sm">{error}</div>;
  }

  return (
    <section className="done-page-container">
      <div className="done-page-content">
        {/* チェックアイコン: 円の中にチェック（大きめ） */}
        <div className="done-page-icon">
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ color: "var(--accent)" }} /* テーマカラーを適用 */
          >
            {/* 円の背景（テーマカラー） */}
            <circle cx="60" cy="60" r="60" fill="currentColor" />
            {/* チェックマーク（白、太め） */}
            <path
              d="M35 60 L50 75 L85 40"
              stroke="white"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>

        {/* メイン文言: 「すべてのタスクが完了しました！」 */}
        <h1 className="done-page-title">すべてのタスクが完了しました！</h1>

        {/* サブ文言: 「お疲れ様でした。」 */}
        <p className="done-page-subtitle">お疲れ様でした。</p>

        {/* 追加情報: 「完了したリスト: {リスト名}」（データがある場合のみ表示） */}
        {payload?.title ? (
          <p className="done-page-list-name">完了したリスト: {payload.title}</p>
        ) : null}

        {/* CTAボタン: 「ホームへ戻る」 */}
        <button
          type="button"
          className="rm-btn rm-btn-primary done-page-home-btn"
          onClick={() => router.push("/routines")}
        >
          ホームへ戻る
        </button>
      </div>
    </section>
  );
}
