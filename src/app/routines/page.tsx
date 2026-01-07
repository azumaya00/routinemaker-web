"use client";

/**
 * ルーティン一覧ページ（ログイン後ホーム）
 * 
 * 責務：
 * - ルーティン一覧の表示
 * - 新規作成・実行・編集・削除の導線提供
 * - Phase 4 までの責務は「一覧」「新規作成導線」「実行導線」に限定
 * 
 * レイアウト責務：
 * - AppShellのMain領域に表示するコンテンツのみを返す
 * - Header/FooterのレイアウトはAppShell側で制御されるため考慮不要
 * - このページはログイン後なので、Footerは表示されない
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { deleteRoutine, getCsrfCookie, listRoutines } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

type Routine = {
  id: number;
  title: string;
  tasks: string[];
};

const parseJson = <T,>(input: string): T | null => {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
};

export default function RoutinesPage() {
  const router = useRouter();
  const { status, me } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);

  // 認証判定は /api/me の成否だけを使う方針。
  useEffect(() => {
    void me();
  }, [me]);

  // チュートリアルは初回ログインのみ表示する前提のため、ローカルに記録する。
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const seen = window.localStorage.getItem("rm_tutorial_seen");
    setShowTutorial(!seen);
  }, []);

  // 一覧は /routines でのみ取得する前提。
  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    setError(null);
    setLoading(true);
    void listRoutines().then((result) => {
      if (result.status === 200) {
        const parsed = parseJson<{ data: Routine[] }>(result.body);
        setRoutines(parsed?.data ?? []);
        setLoading(false);
        return;
      }

      if (result.status === 401) {
        void me();
        return;
      }

      setError(`一覧取得に失敗しました (${result.status})`);
      setLoading(false);
    });
  }, [status, router, me]);

  const handleDelete = async (id: number) => {
    // 削除は一覧画面で許可するが、詳細編集は別画面に寄せる方針。
    setError(null);
    await getCsrfCookie();
    const result = await deleteRoutine(id);
    if (result.status === 200) {
      const refreshed = await listRoutines();
      if (refreshed.status === 200) {
        const parsed = parseJson<{ data: Routine[] }>(refreshed.body);
        setRoutines(parsed?.data ?? []);
      }
      return;
    }

    setError(`削除に失敗しました (${result.status})`);
  };

  if (loading) {
    return <div className="rm-muted text-sm">Loading...</div>;
  }

  return (
    <section className="space-y-10">
      {/* タイトル: 余白を増やし、フォントサイズを少し大きくして存在感を出す */}
      <h1 className="text-2xl font-semibold">今日は、何から始めますか？</h1>
      
      {/* チュートリアル: 情報量を減らすため、視認性を下げる（opacity を下げ、フォントサイズを小さく） */}
      {showTutorial ? (
        <div className="rm-muted text-xs opacity-60">
          <div>チュートリアル（初回のみ表示）</div>
          <button
            type="button"
            className="rm-btn rm-btn-sm mt-2"
            onClick={() => {
              // 初回表示の扱いは要件に明示がないため、ローカル記録で代替する。
              window.localStorage.setItem("rm_tutorial_seen", "1");
              setShowTutorial(false);
            }}
          >
            閉じる
          </button>
        </div>
      ) : null}
      
      {/* エラーメッセージ: 情報量を減らすため、視認性を下げる */}
      {error ? <div className="rm-muted text-xs opacity-60">{error}</div> : null}

      {/* 主役の操作ボタン: 「+ 新しく作る」を大きく目立たせる */}
      <div className="flex gap-3">
        <button
          type="button"
          className="rm-btn rm-btn-primary rm-btn-lg"
          onClick={() => router.push("/routines/new")}
        >
          + 新しく作る
        </button>
        {/* 履歴ボタン: 情報量を減らすため、視認性を下げる */}
        <button
          type="button"
          className="rm-btn rm-btn-sm opacity-70"
          onClick={() => router.push("/histories")}
        >
          履歴
        </button>
      </div>

      {/* ルーティン一覧: カード間の余白を増やし、カード内の余白も増やす */}
      <section className="space-y-4">
        {/* 空状態メッセージ: 情報量を減らすため、視認性を下げる */}
        {routines.length === 0 ? (
          <div className="rm-muted text-xs opacity-60">No routines yet.</div>
        ) : null}
        {routines.map((routine) => (
          <div
            key={routine.id}
            className="rm-card flex items-center justify-between py-4 px-5"
          >
            {/* ルーティンタイトル: フォントサイズを少し大きくして読みやすく */}
            <div className="text-base font-medium">{routine.title}</div>
            <div className="flex gap-2">
              {/* 主役の操作: 「実行へ」を目立たせる（primary スタイル + サイズを大きく） */}
              <button
                type="button"
                className="rm-btn rm-btn-primary"
                onClick={() =>
                  router.push(`/routines/${routine.id}/preflight`)
                }
              >
                実行へ
              </button>
              {/* 編集・削除ボタン: 情報量を減らすため、視認性を下げる */}
              <button
                type="button"
                className="rm-btn rm-btn-sm opacity-60"
                onClick={() => router.push(`/routines/${routine.id}`)}
              >
                編集
              </button>
              <button
                type="button"
                className="rm-btn rm-btn-sm opacity-60"
                onClick={() => void handleDelete(routine.id)}
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </section>
    </section>
  );
}
