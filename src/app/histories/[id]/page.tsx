"use client";

// 履歴詳細は「やったことの記録」だけを静かに出す。
// 反省や分析の UI を入れない前提で最小情報に留める。

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getHistory } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";

type HistoryDetail = {
  id: number;
  routine_id: number;
  title: string;
  tasks: string[];
  started_at: string | null;
  finished_at: string | null;
  completed: boolean;
};

const parseJson = <T,>(input: string): T | null => {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
};

// 履歴の日時表示: 「YYYY/MM/DD HH:mm」形式
const formatDateTime = (value: string | null) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}`;
};

// 実行日時の範囲表示: 「YYYY/MM/DD HH:mm - HH:mm」形式
const formatDateTimeRange = (
  startedAt: string | null,
  finishedAt: string | null
) => {
  const start = formatDateTime(startedAt);
  const finish = formatDateTime(finishedAt);
  if (start === "-" && finish === "-") {
    return "-";
  }
  if (start === "-") {
    return finish;
  }
  if (finish === "-") {
    return `${start} -`;
  }
  return `${start} - ${finish}`;
};

export default function HistoryDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { status: authStatus, me } = useAuth();
  const [history, setHistory] = useState<HistoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const historyId = Number(params?.id);

  // 認証判定は /api/me の成否で揃える。
  useEffect(() => {
    void me();
  }, [me]);

  // 未認証の遷移はガードに一本化する。

  // 詳細は /histories/[id] でのみ取得する。
  useEffect(() => {
    if (!historyId || Number.isNaN(historyId)) {
      setError("履歴IDが不正です。");
      return;
    }

    if (authStatus !== "authenticated") {
      return;
    }

    setError(null);
    void getHistory(historyId).then((result) => {
      if (result.status === 200) {
        const parsed = parseJson<{ data: HistoryDetail }>(result.body);
        setHistory(parsed?.data ?? null);
        return;
      }

      if (result.status === 401) {
        void me();
        return;
      }

      setError(`履歴取得に失敗しました (${result.status})`);
    });
  }, [historyId, authStatus, router, me]);

  // ステータス判定（履歴の完了状態）
  // 完了していない場合は、終了時刻の有無に関わらず「中断」として表示
  const getHistoryStatus = () => {
    if (history?.completed) {
      return "completed";
    }
    if (history?.finished_at) {
      return "interrupted"; // 中断（完了していないが終了時刻がある）
    }
    return "incomplete"; // 中断（終了時刻がない、UIでは「中断」として表示）
  };

  if (error) {
    return <div className="history-detail-error">{error}</div>;
  }

  if (!history) {
    return <LoadingSpinner />;
  }

  const historyStatus = getHistoryStatus();

  return (
    <section className="history-detail-container">
      {/* 戻るボタン: 上部に配置（誤タップを防ぐ、他の画面と統一） */}
      <button
        type="button"
        className="routine-form-back-btn"
        onClick={() => router.push("/histories")}
      >
        ← 戻る
      </button>

      <h1 className="history-detail-title">履歴詳細</h1>

      {/* サマリーセクション */}
      <div className="history-detail-summary">
        <div className="history-detail-summary-left">
          <div className="history-detail-summary-item">
            <span className="history-detail-summary-label">リスト名:</span>
            <span className="history-detail-summary-value">{history.title}</span>
          </div>
          <div className="history-detail-summary-item">
            <span className="history-detail-summary-label">実行日時:</span>
            <span className="history-detail-summary-value">
              {formatDateTimeRange(history.started_at, history.finished_at)}
            </span>
          </div>
        </div>
        <div className={`history-detail-status history-detail-status-${historyStatus}`}>
          {historyStatus === "completed" && (
            <>
              {/* 完了アイコン: テーマカラーを使用 */}
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ color: "var(--accent)" }} /* テーマカラーを適用 */
              >
                <circle cx="16" cy="16" r="16" fill="currentColor" />
                <path
                  d="M10 16 L14 20 L22 12"
                  stroke="#f8fafc"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              <span>完了</span>
            </>
          )}
          {historyStatus === "interrupted" && (
            <>
              {/* 中断アイコン: テーマ変数を使用（ダークモード対応） */}
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ color: "var(--fg)" }} /* テーマに追従する中間色 */
              >
                <circle cx="16" cy="16" r="16" fill="currentColor" />
                <rect x="12" y="8" width="3" height="16" fill="#f8fafc" />
                <rect x="17" y="8" width="3" height="16" fill="#f8fafc" />
              </svg>
              <span>中断</span>
            </>
          )}
          {historyStatus === "incomplete" && (
            <>
              {/* 一時停止風アイコン（pause）: グレー系で表示（一覧と同じスタイル、テーマ変数を使用） */}
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="中断"
                style={{ color: "var(--gray-500)" }} /* テーマ変数を使用（ダークモード対応） */
              >
                <circle cx="16" cy="16" r="16" fill="currentColor" />
                <rect x="12" y="8" width="3" height="16" fill="#f8fafc" />
                <rect x="17" y="8" width="3" height="16" fill="#f8fafc" />
              </svg>
              <span>中断</span>
            </>
          )}
        </div>
      </div>

      {/* タスク実行結果セクション */}
      <div className="history-detail-tasks">
        <h2 className="history-detail-tasks-title">タスク実行結果</h2>
        <div className="history-detail-tasks-list">
          {history.tasks.map((task, index) => (
            <div key={`task-${index}`} className="history-detail-task-card">
              {/* 完了したタスクはチェックアイコンを表示（テーマカラーを使用） */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="history-detail-task-icon"
                style={{ color: "var(--accent)" }} /* テーマカラーを適用 */
              >
                <circle cx="10" cy="10" r="10" fill="currentColor" />
              <path
                d="M6 10 L9 13 L14 7"
                stroke="#f8fafc"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              </svg>
              <span className="history-detail-task-text">{task}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
