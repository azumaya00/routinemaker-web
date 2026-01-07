"use client";

// ルーティン編集画面。作成画面と責務を分けて、編集だけを担う。
// Phase 4 までは「タイトル/タスク編集」と保存のみを提供する。

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getCsrfCookie, getRoutine, updateRoutine } from "@/lib/api";
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

const normalizeTasks = (tasks: string[]) =>
  tasks.map((task) => task.trim()).filter((task) => task.length > 0);

const canAppendTask = (tasks: string[]) => {
  if (tasks.length >= 10) {
    return false;
  }

  const last = tasks[tasks.length - 1] ?? "";
  return last.trim().length > 0;
};

export default function RoutineEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { status, me } = useAuth();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [title, setTitle] = useState("");
  const [tasks, setTasks] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  const routineId = useMemo(() => Number(params?.id), [params?.id]);

  // 認証判定は /api/me の成否に揃える。
  useEffect(() => {
    void me();
  }, [me]);

  // 未認証の遷移はガード側で統一する。

  // 編集対象は /routines/[id] でのみ取得する。
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
        const data = parsed?.data ?? null;
        setRoutine(data);
        setTitle(data?.title ?? "");
        setTasks(data?.tasks ?? [""]);
        return;
      }

      if (result.status === 401) {
        void me();
        return;
      }

      setError(`ルーティン取得に失敗しました (${result.status})`);
    });
  }, [routineId, status, router, me]);

  // 上限未満に戻ったら警告を消す。
  useEffect(() => {
    if (tasks.length < 10 && limitMessage) {
      setLimitMessage(null);
    }
  }, [tasks.length, limitMessage]);

  const handleAddTask = () => {
    // 11個目の追加操作時のみ制限メッセージを出す。
    if (tasks.length >= 10) {
      setLimitMessage("Max 10 tasks.");
      return;
    }

    if (!canAppendTask(tasks)) {
      return;
    }

    setLimitMessage(null);
    setTasks((prev) => [...prev, ""]);
  };

  const handleSave = async () => {
    if (!routine) {
      return;
    }

    setError(null);
    const normalized = normalizeTasks(tasks);
    if (normalized.length === 0) {
      setError("タスクは1件以上入力してください。");
      return;
    }

    // 保存はこの画面の責務として更新だけ行う。
    await getCsrfCookie();
    const result = await updateRoutine(routine.id, {
      title,
      tasks: normalized,
    });
    if (result.status === 200) {
      router.push("/routines");
      return;
    }

    if (result.status === 422) {
      setError("入力内容を確認してください。");
      return;
    }

    setError(`保存に失敗しました (${result.status})`);
  };

  if (error) {
    return <div className="rm-muted text-sm">{error}</div>;
  }

  if (!routine) {
    return <div className="rm-muted text-sm">Loading...</div>;
  }

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">編集</h1>

      <label className="text-sm">
        Title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rm-input mt-1"
        />
      </label>

      <div className="space-y-2">
        <div className="text-sm">Tasks</div>
        {tasks.map((task, index) => (
          <div key={`task-${index}`} className="flex gap-2">
            <input
              value={task}
              onChange={(event) =>
                setTasks((prev) =>
                  prev.map((item, itemIndex) =>
                    itemIndex === index ? event.target.value : item
                  )
                )
              }
              className="rm-input w-full"
            />
            <button
              type="button"
              className="rm-btn rm-btn-sm"
              onClick={() =>
                setTasks((prev) =>
                  prev.filter((_, itemIndex) => itemIndex !== index)
                )
              }
              disabled={tasks.length <= 1}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="rm-btn"
          onClick={handleAddTask}
        >
          Add task
        </button>
        {limitMessage ? (
          <div className="rm-muted text-xs">{limitMessage}</div>
        ) : null}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="rm-btn"
          onClick={() => router.push("/routines")}
        >
          Back
        </button>
        <button
          type="button"
          className="rm-btn rm-btn-primary"
          onClick={handleSave}
        >
          Save
        </button>
      </div>
    </section>
  );
}
