"use client";

// 実行前確認画面。並び替えはここでのみ行い、他画面に混ぜない。
// 実行開始時に履歴を作成し /run/[historyId] へ遷移する。

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  getCsrfCookie,
  getRoutine,
  startHistory,
  updateRoutine,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

type Routine = {
  id: number;
  title: string;
  tasks: string[];
};

type History = {
  id: number;
};

const parseJson = <T,>(input: string): T | null => {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
};

export default function PreflightPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { status, me } = useAuth();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [tasks, setTasks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const routineId = useMemo(() => Number(params?.id), [params?.id]);

  // 認証判定は /api/me の成否で統一する。
  useEffect(() => {
    void me();
  }, [me]);

  // 未認証の遷移はガードに一本化する。

  // 実行対象のルーティンを取得し、並び替え用の state を別に持つ。
  useEffect(() => {
    if (!routineId || Number.isNaN(routineId)) {
      setError("ルーティンIDが不正です。");
      return;
    }

    if (status !== "authenticated") {
      return;
    }

    setError(null);
    void getRoutine(routineId).then((result) => {
      if (result.status === 200) {
        const parsed = parseJson<{ data: Routine }>(result.body);
        setRoutine(parsed?.data ?? null);
        setTasks(parsed?.data?.tasks ?? []);
        return;
      }

      if (result.status === 401) {
        void me();
        return;
      }

      setError(`ルーティン取得に失敗しました (${result.status})`);
    });
  }, [routineId, status, router, me]);

  const moveTask = (from: number, to: number) => {
    if (to < 0 || to >= tasks.length) {
      return;
    }

    // 並び替えはこの画面でのみ許可する方針。
    setTasks((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleStart = async () => {
    if (!routine) {
      setError("ルーティン情報がありません。");
      return;
    }

    setError(null);
    await getCsrfCookie();

    // 並び替え結果を反映するため、開始前に tasks を更新しておく。
    const updateResult = await updateRoutine(routine.id, {
      title: routine.title,
      tasks,
    });
    if (updateResult.status !== 200) {
      setError(`並び替えの反映に失敗しました (${updateResult.status})`);
      return;
    }

    // 開始は履歴 API を起点にし、historyId を受け取って遷移する。
    const startResult = await startHistory(routine.id);
    if (startResult.status === 201) {
      const parsed = parseJson<{ data: History }>(startResult.body);
      const historyId = parsed?.data?.id;
      if (!historyId) {
        setError("履歴IDが取得できませんでした。");
        return;
      }

      // /run 側でタスクを参照できるよう、historyId 単位で保存する。
      sessionStorage.setItem(
        `run:${historyId}`,
        JSON.stringify({ title: routine.title, tasks })
      );

      router.push(`/run/${historyId}`);
      return;
    }

    setError(`開始に失敗しました (${startResult.status})`);
  };

  if (error) {
    return <div className="text-sm text-slate-600">{error}</div>;
  }

  if (!routine) {
    return <div className="text-sm text-slate-600">Loading...</div>;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">実行前</h1>
      <div className="text-sm text-slate-600">{routine.title}</div>

      <div className="space-y-2">
        <div className="text-sm">Tasks</div>
        {tasks.map((task, index) => (
          <div
            key={`${routine.id}-${index}`}
            className="flex items-center gap-2 border border-slate-200 p-2 text-sm"
          >
            <div className="flex-1">{task}</div>
            <button
              type="button"
              className="border border-slate-200 px-2 text-xs"
              onClick={() => moveTask(index, index - 1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="border border-slate-200 px-2 text-xs"
              onClick={() => moveTask(index, index + 1)}
            >
              ↓
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="border border-slate-200 px-3 py-2 text-sm"
          onClick={() => router.push("/routines")}
        >
          Back
        </button>
        <button
          type="button"
          className="border border-slate-200 px-3 py-2 text-sm"
          onClick={handleStart}
        >
          Start
        </button>
      </div>
    </section>
  );
}
