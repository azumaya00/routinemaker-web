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

import { deleteRoutine, dismissTutorial, getCsrfCookie, listRoutines } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useFlash } from "@/components/FlashMessageProvider";

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
  const { status, me, user } = useAuth();
  const { showFlash } = useFlash();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 認証判定は /api/me の成否だけを使う方針。
  useEffect(() => {
    void me();
  }, [me]);

  // チュートリアルは初回ログイン時のみ表示する
  // 判定条件：
  // 1. /api/me が成功し、user が存在すること（認証が確定したタイミング）
  // 2. user.tutorial_should_show === true（DBで管理、tutorial_dismissed_at が null の場合）
  // ×ボタンで閉じた場合は、POST /api/tutorial/dismiss を呼び出してDBに保存
  // ログイン経路（ログイン/新規登録/将来のGoogle OAuth）に依存しない実装
  useEffect(() => {
    // /api/me が成功し、user が存在するタイミングでチュートリアル表示を判定
    // これにより、新規登録直後の遷移でも確実に判定される
    if (user) {
      // DBで管理されている tutorial_should_show で判定
      setShowTutorial(user.tutorial_should_show ?? false);
    } else {
      // user が存在しない場合は非表示
      setShowTutorial(false);
    }
  }, [user]);

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

  // 削除ボタンクリック時: 確認ダイアログを開く
  const handleDeleteClick = (id: number) => {
    setDeleteTargetId(id);
    setDeleteDialogOpen(true);
  };

  // 削除確認: 実際の削除処理を実行
  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;

    setDeleteLoading(true);
    setError(null);
    
    try {
      await getCsrfCookie();
      const result = await deleteRoutine(deleteTargetId);
      
      if (result.status === 200) {
        // 一覧を再取得
        const refreshed = await listRoutines();
        if (refreshed.status === 200) {
          const parsed = parseJson<{ data: Routine[] }>(refreshed.body);
          setRoutines(parsed?.data ?? []);
        }
        // 成功フラッシュを表示
        showFlash("success", "削除しました");
        // ローディング状態を解除
        setDeleteLoading(false);
        // ダイアログを閉じる
        setDeleteDialogOpen(false);
        setDeleteTargetId(null);
      } else {
        // エラーフラッシュを表示（ダイアログは閉じない）
        // 技術的詳細（ステータスコード）はコンソールに出力（ユーザーには見せない）
        console.error("Delete routine failed:", result.status, result.body);
        showFlash("error", "削除に失敗しました。もう一度お試しください。");
        setDeleteLoading(false); // エラー時はローディングを解除して再試行可能にする
      }
    } catch (err) {
      // エラーフラッシュを表示（ダイアログは閉じない）
      // 技術的詳細はコンソールに出力（ユーザーには見せない）
      console.error("Delete routine error:", err);
      showFlash("error", "削除に失敗しました。もう一度お試しください。");
      setDeleteLoading(false); // エラー時はローディングを解除して再試行可能にする
    }
  };

  // 削除キャンセル
  const handleDeleteCancel = () => {
    // ローディング状態を解除（処理中にキャンセルした場合に備える）
    setDeleteLoading(false);
    setDeleteDialogOpen(false);
    setDeleteTargetId(null);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <section className="routines-home-container">
      {/* ページ見出し: 大きめに、中央カラム内で左寄せ */}
      <h1 className="routines-home-title">今日は、何から始めますか？</h1>
      
      {/* チュートリアル案内カード: ガラス風（薄い青、半透明、薄い枠線、角丸大きめ） */}
      {showTutorial ? (
        <div className="routines-home-tutorial-card">
          <div className="routines-home-tutorial-content">
            <div className="routines-home-tutorial-title">RoutineMakerへようこそ</div>
            <div className="routines-home-tutorial-description">
              RoutineMakerは、やることが多いと止まってしまう人のためのタスク管理アプリです。<br />
              まずはタスクリストを作って、再生ボタンから「今やるひとつ」を始めてみましょう。  
            </div>
          </div>
          <button
            type="button"
            className="routines-home-tutorial-close"
            onClick={async () => {
              // チュートリアルを閉じたことをDBに保存
              try {
                await getCsrfCookie();
                const result = await dismissTutorial();
                if (result.status === 200) {
                  // 成功したら即座にUIからチュートリアルを消す
                  setShowTutorial(false);
                  // /api/me を再取得して状態を更新
                  await me();
                } else {
                  // 失敗した場合は控えめにエラーを表示（実行中画面には影響なし）
                  console.error("Failed to dismiss tutorial:", result.status, result.body);
                  // フラッシュメッセージは出さない（過剰に騒がない）
                }
              } catch (err) {
                // エラー時も控えめに処理
                console.error("Error dismissing tutorial:", err);
              }
            }}
            aria-label="閉じる"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              style={{ width: "20px", height: "20px", stroke: "var(--gray-400)" }}
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : null}
      
      {/* エラーメッセージ */}
      {error ? <div className="routines-home-error rm-muted text-xs opacity-60">{error}</div> : null}

      {/* 主導線エリア: 丸いピル型の主ボタン + 履歴リンク */}
      <div className="routines-home-actions">
        <button
          type="button"
          className="rm-btn rm-btn-primary routines-home-create-btn"
          onClick={() => {
            // freeユーザーで10件以上作成済みの場合は制限
            if (user?.plan === 'free' && routines.length >= 10) {
              showFlash(
                "error",
                "無料プランではタスクリストは10件までです。"
              );
              return;
            }
            // それ以外は従来どおり新規作成画面に遷移
            router.push("/routines/new");
          }}
        >
          ＋ 新しいタスクリストを作る
        </button>
        <button
          type="button"
          className="routines-home-history-link"
          onClick={() => router.push("/histories")}
        >
          履歴
        </button>
      </div>

      {/* タスクリストのカード一覧: カード型（白背景、角丸大、薄い影） */}
      <section className="routines-home-list">
        {/* 空状態メッセージ */}
        {routines.length === 0 ? (
          <div className="routines-home-empty rm-muted text-xs opacity-60">ルーティンがありません</div>
        ) : null}
        {routines.map((routine) => (
          <div key={routine.id} className="routines-home-item">
            {/* リスト名（左） */}
            <div className="routines-home-item-title">{routine.title}</div>
            {/* 操作群（右）: 実行する（主・円形アイコン） + 編集・削除（副・控えめ） */}
            <div className="routines-home-item-actions">
              <button
                type="button"
                className="routines-home-item-run"
                onClick={() => router.push(`/routines/${routine.id}/preflight`)}
                aria-label="実行する"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  style={{ width: "20px", height: "20px", fill: "#f8fafc" }}
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <button
                type="button"
                className="routines-home-item-edit"
                onClick={() => router.push(`/routines/${routine.id}`)}
                aria-label="編集"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  style={{ width: "20px", height: "20px", stroke: "var(--fg)", fill: "none" }}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                type="button"
                className="routines-home-item-delete"
                onClick={() => handleDeleteClick(routine.id)}
                aria-label="削除"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  style={{ width: "20px", height: "20px", stroke: "var(--fg)", fill: "none" }}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="リストを削除しますか？"
        description="この操作は取り消せません。"
        confirmLabel="削除する"
        cancelLabel="キャンセル"
        confirmVariant="destructive"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        loading={deleteLoading}
      />
    </section>
  );
}
