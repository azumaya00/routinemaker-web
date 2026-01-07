"use client";

// 履歴一覧は「積み上がりの確認」だけに留め、分析や反省を促さない。
// 一覧は軽量な項目に絞り、詳細は別画面に分離する。

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { listHistories } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

type HistorySummary = {
  id: number;
  routine_id: number;
  title: string;
  started_at: string | null;
  finished_at: string | null;
  completed: boolean;
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

// 履歴の時刻は秒までの表示で十分なので、余分な精度を落とす。
const formatTimestamp = (value: string | null) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

export default function HistoriesPage() {
  const router = useRouter();
  const { status, me } = useAuth();
  const [items, setItems] = useState<HistorySummary[]>([]);
  const [meta, setMeta] = useState<HistoryListMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const nextPath = useMemo(() => toPath(meta?.next_page_url ?? null), [meta]);
  const prevPath = useMemo(() => toPath(meta?.prev_page_url ?? null), [meta]);

  // 認証判定は /api/me の成否のみを使う。
  useEffect(() => {
    void me();
  }, [me]);

  // 未認証の遷移はガード側で統一する。

  const loadHistories = async (path = "/api/histories") => {
    setError(null);
    setLoading(true);
    const result = await listHistories(path);
    if (result.status === 200) {
      const parsed = parseJson<{ data: HistorySummary[]; meta: HistoryListMeta }>(
        result.body
      );
      setItems(parsed?.data ?? []);
      setMeta(parsed?.meta ?? null);
      setLoading(false);
      return;
    }

    if (result.status === 401) {
      void me();
      return;
    }

    setError(`履歴取得に失敗しました (${result.status})`);
    setLoading(false);
  };

  // 履歴は一覧専用画面でのみ取得する前提。
  useEffect(() => {
    if (status === "authenticated") {
      void loadHistories();
    }
  }, [status]);

  if (loading) {
    return <div className="rm-muted text-sm">Loading...</div>;
  }

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Histories</h1>
      {error ? <div className="rm-muted text-sm">{error}</div> : null}

      {items.length === 0 ? (
        <div className="rm-muted text-sm">
          まだ履歴がありません。
        </div>
      ) : null}

      <section className="space-y-2">
        {items.map((history) => (
          <button
            key={history.id}
            type="button"
            className="rm-card flex w-full items-center justify-between text-left text-sm"
            onClick={() => router.push(`/histories/${history.id}`)}
          >
            <div className="flex flex-col gap-1">
              <div>{history.title}</div>
              <div className="rm-muted text-xs">
                {formatTimestamp(history.started_at)} →{" "}
                {formatTimestamp(history.finished_at)}
              </div>
            </div>
            <div className="rm-muted text-xs">
              {history.completed ? "完了" : "中断"}
            </div>
          </button>
        ))}
      </section>

      <div className="flex gap-2">
        <button
          type="button"
          className="rm-btn"
          onClick={() => prevPath && void loadHistories(prevPath)}
          disabled={!prevPath}
        >
          前へ
        </button>
        <button
          type="button"
          className="rm-btn"
          onClick={() => nextPath && void loadHistories(nextPath)}
          disabled={!nextPath}
        >
          次へ
        </button>
      </div>
    </section>
  );
}
