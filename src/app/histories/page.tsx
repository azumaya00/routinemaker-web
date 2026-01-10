"use client";

// 履歴一覧は「積み上がりの確認」だけに留め、分析や反省を促さない。
// 一覧は軽量な項目に絞り、詳細は別画面に分離する。

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { listHistories } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";

type HistorySummary = {
  id: number;
  routine_id: number;
  title: string;
  started_at: string | null;
  finished_at: string | null;
  completed: boolean; // true: 完了, false: 中断（UIでは「中断」として統一表示）
};

type HistoryListMeta = {
  next_page_url: string | null;
  prev_page_url: string | null;
};

const parseJson = <T,>(input: string): T | null => {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
};

const toPath = (url: string | null) => {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
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

export default function HistoriesPage() {
  const router = useRouter();
  const { status, me } = useAuth();
  const [allItems, setAllItems] = useState<HistorySummary[]>([]); // 全件を保持
  const [currentPage, setCurrentPage] = useState(1); // 現在のページ番号（1始まり）
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ページネーション: 1ページ10件固定
  const ITEMS_PER_PAGE = 10;

  // 認証判定は /api/me の成否のみを使う。
  useEffect(() => {
    void me();
  }, [me]);

  // 未認証の遷移はガード側で統一する。

  // 履歴を全件取得（API側のページネーションは使わない）
  // APIがページネーション対応している場合、複数回リクエストして全件取得する
  const loadHistories = async () => {
    setError(null);
    setLoading(true);
    
    try {
      const allHistories: HistorySummary[] = [];
      let currentPage = 1;
      let hasMore = true;

      // 全件取得するまで複数回リクエスト
      while (hasMore) {
        const result = await listHistories(`/api/histories?page=${currentPage}&per_page=100`);
        if (result.status === 200) {
          const parsed = parseJson<{ data: HistorySummary[]; meta: HistoryListMeta }>(
            result.body
          );
          const items = parsed?.data ?? [];
          allHistories.push(...items);

          // 次のページがあるかチェック
          const meta = parsed?.meta ?? null;
          if (meta?.next_page_url) {
            currentPage++;
          } else {
            hasMore = false;
          }
        } else if (result.status === 401) {
          void me();
          setLoading(false);
          return;
        } else {
          setError(`履歴取得に失敗しました (${result.status})`);
          setLoading(false);
          return;
        }
      }

      // 全件をstateに保存
      setAllItems(allHistories);
      setLoading(false);
    } catch (err) {
      setError("履歴取得に失敗しました");
      setLoading(false);
    }
  };

  // 履歴は一覧専用画面でのみ取得する前提。
  // 全件取得して、フロントエンド側でページネーション
  useEffect(() => {
    if (status === "authenticated") {
      void loadHistories();
    }
  }, [status]);

  // 現在のページに表示する10件を計算
  const displayedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return allItems.slice(startIndex, endIndex);
  }, [allItems, currentPage]);

  // 総ページ数を計算
  const totalPages = useMemo(() => {
    return Math.ceil(allItems.length / ITEMS_PER_PAGE);
  }, [allItems.length]);

  // 前のページがあるか
  const hasPrevPage = currentPage > 1;
  // 次のページがあるか
  const hasNextPage = currentPage < totalPages;

  // ステータス判定: 完了/中断
  // 完了していない場合は、終了時刻の有無に関わらず「中断」として表示
  const getStatus = (history: HistorySummary) => {
    if (history.completed) {
      return "completed";
    }
    if (history.finished_at) {
      return "interrupted"; // 中断（完了していないが終了時刻がある）
    }
    return "incomplete"; // 中断（終了時刻がない、UIでは「中断」として表示）
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <section className="histories-container">
      {/* 戻るボタン: 上部に配置（誤タップを防ぐ、他の画面と統一） */}
      <button
        type="button"
        className="routine-form-back-btn"
        onClick={() => router.push("/routines")}
      >
        ← 戻る
      </button>

      <h1 className="histories-title">実行履歴</h1>
      {error ? <div className="histories-error">{error}</div> : null}

      {allItems.length === 0 ? (
        <div className="histories-empty">
          まだ履歴がありません。
        </div>
      ) : (
        <>
          {/* 履歴カード一覧: 現在のページの10件のみ表示 */}
          <div className="histories-list">
            {displayedItems.map((history) => {
              const status = getStatus(history);
              return (
                <button
                  key={history.id}
                  type="button"
                  className="history-card"
                  onClick={() => router.push(`/histories/${history.id}`)}
                >
                  {/* 左側: リスト名と実行日時 */}
                  <div className="history-card-left">
                    <div className="history-card-title">{history.title}</div>
                    <div className="history-card-date">
                      {formatDateTime(history.started_at)}
                    </div>
                  </div>

                  {/* 右側: ステータス（アイコン＋文言） */}
                  <div className={`history-card-status history-card-status-${status}`}>
                    {status === "completed" && (
                      <>
                        {/* 完了アイコン: テーマカラーを使用 */}
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          style={{ color: "var(--accent)" }} /* テーマカラーを適用 */
                        >
                          <circle cx="10" cy="10" r="10" fill="currentColor" />
                      <path
                        d="M6 10 L9 13 L14 7"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                        </svg>
                        <span>完了</span>
                      </>
                    )}
                    {status === "interrupted" && (
                      <>
                        {/* 中断アイコン: グレーの丸に白い停止ボタン（履歴詳細と同じスタイル、テーマ変数を使用） */}
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-label="中断"
                          style={{ color: "var(--gray-500)" }} /* テーマ変数を使用（ダークモード対応） */
                        >
                          <circle cx="10" cy="10" r="10" fill="currentColor" />
                      <rect x="6" y="4" width="2" height="12" fill="white" />
                      <rect x="12" y="4" width="2" height="12" fill="white" />
                        </svg>
                        <span>中断</span>
                      </>
                    )}
                    {status === "incomplete" && (
                      <>
                        {/* 一時停止風アイコン（pause）: グレー系で表示（テーマ変数を使用） */}
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-label="中断"
                          style={{ color: "var(--gray-500)" }} /* テーマ変数を使用（ダークモード対応） */
                        >
                          <circle cx="10" cy="10" r="10" fill="currentColor" />
                      <rect x="6" y="4" width="2" height="12" fill="white" />
                      <rect x="12" y="4" width="2" height="12" fill="white" />
                        </svg>
                        <span>中断</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ページネーション: 「< 1 2 3 … >」形式（フロントエンド側で制御） */}
          <div className="histories-pagination">
            <button
              type="button"
              className="histories-pagination-btn"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={!hasPrevPage}
              aria-label="前のページ"
            >
              &lt;
            </button>
            <div className="histories-pagination-pages">
              {/* 現在のページと前後のページを表示 */}
              {currentPage > 1 && (
                <button
                  type="button"
                  className="histories-pagination-page"
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  {currentPage - 1}
                </button>
              )}
              <span className="histories-pagination-page active">
                {currentPage}
              </span>
              {hasNextPage && (
                <>
                  {currentPage + 1 <= totalPages && (
                    <button
                      type="button"
                      className="histories-pagination-page"
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      {currentPage + 1}
                    </button>
                  )}
                  {currentPage + 1 < totalPages && (
                    <span className="histories-pagination-ellipsis">…</span>
                  )}
                </>
              )}
            </div>
            <button
              type="button"
              className="histories-pagination-btn"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={!hasNextPage}
              aria-label="次のページ"
            >
              &gt;
            </button>
          </div>
        </>
      )}
    </section>
  );
}
