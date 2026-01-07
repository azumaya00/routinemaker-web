"use client";

// 履歴詳細は「やったことの記録」だけを静かに出す。
// 反省や分析の UI を入れない前提で最小情報に留める。

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getHistory } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

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

// 履歴の時刻は秒までの表示に揃える。
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

export default function HistoryDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { status, me } = useAuth();
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

    if (status !== "authenticated") {
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
  }, [historyId, status, router]);

  if (error) {
    return <div className="rm-muted text-sm">{error}</div>;
  }

  if (!history) {
    return <div className="rm-muted text-sm">Loading...</div>;
  }

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">{history.title}</h1>
      <div className="rm-muted text-sm">
        {formatTimestamp(history.started_at)} →{" "}
        {formatTimestamp(history.finished_at)}
      </div>
      <div className="rm-muted text-sm">
        {history.completed ? "完了" : "中断"}
      </div>

      <section className="space-y-2">
        <div className="text-sm">Tasks</div>
        {history.tasks.map((task, index) => (
          <div
            key={`task-${index}`}
            className="rm-card text-sm"
          >
            {task}
          </div>
        ))}
      </section>

      <button
        type="button"
        className="rm-btn"
        onClick={() => router.push("/histories")}
      >
        戻る
      </button>
    </section>
  );
}
