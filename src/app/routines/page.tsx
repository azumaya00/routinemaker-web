"use client";

// Phase 3 の最小ルーティン管理画面。見た目は暫定で機能優先とする。

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createRoutine,
  deleteRoutine,
  getCsrfCookie,
  listRoutines,
  type RoutinePayload,
  updateRoutine,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

// API の data 形に合わせた最小モデル。
type Routine = {
  id: number;
  title: string;
  tasks: string[];
};

// 空白のみのタスクは保存しない前提のため、送信前に正規化する。
const normalizeTasks = (tasks: string[]) =>
  tasks.map((task) => task.trim()).filter((task) => task.length > 0);

const canAppendTask = (tasks: string[]) => {
  if (tasks.length >= 10) {
    return false;
  }

  const last = tasks[tasks.length - 1] ?? "";
  return last.trim().length > 0;
};

// API からの JSON 失敗を握りつぶして扱いやすくする。
const parseJson = <T,>(input: string): T | null => {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
};

// バリデーションエラーの配列をまとめて表示する。
const getErrorMessage = (body: string) => {
  const parsed = parseJson<{
    message?: string;
    errors?: Record<string, string[]>;
  }>(body);

  if (parsed?.errors) {
    return Object.values(parsed.errors).flat().join(" ");
  }

  return parsed?.message ?? body;
};

export default function RoutinesPage() {
  const router = useRouter();
  const { status, me } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newTasks, setNewTasks] = useState<string[]>([""]);

  // free plan 10 件上限の UI 側制御。
  const isNewTaskLimitReached = useMemo(
    () => newTasks.length >= 10,
    [newTasks.length]
  );
  const canAddTask = useMemo(() => canAppendTask(newTasks), [newTasks]);

  // 認証済み前提で一覧を取得する。
  const loadRoutines = useCallback(async () => {
    setError(null);
    const result = await listRoutines();
    if (result.status === 200) {
      const parsed = parseJson<{ data: Routine[] }>(result.body);
      setRoutines(parsed?.data ?? []);
      return;
    }

    if (result.status === 401) {
      router.push("/login");
      return;
    }

    setError(
      `Failed to load routines (${result.status}): ${getErrorMessage(
        result.body
      )}`
    );
  }, [router]);

  // 認証判定は /api/me の成否のみを採用する。
  useEffect(() => {
    void me();
  }, [me]);

  // 未認証は /login へ誘導、認証済みは一覧を取得。
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      setLoading(true);
      void loadRoutines().finally(() => setLoading(false));
    }
  }, [status, router, loadRoutines]);

  // 編集中の値はローカル状態で保持する。
  const updateRoutineField = (
    id: number,
    updater: (routine: Routine) => Routine
  ) => {
    setRoutines((prev) =>
      prev.map((routine) => (routine.id === id ? updater(routine) : routine))
    );
  };

  // 新規作成は CSRF → POST → 再読込の流れ。
  const handleCreate = async () => {
    setError(null);
    const tasks = normalizeTasks(newTasks);
    if (tasks.length === 0) {
      setError("タスクは1件以上入力してください。");
      return;
    }

    const payload: RoutinePayload = {
      title: newTitle,
      tasks,
    };

    await getCsrfCookie();
    const result = await createRoutine(payload);
    if (result.status === 201) {
      setNewTitle("");
      setNewTasks([""]);
      await loadRoutines();
      return;
    }

    if (result.status === 422) {
      setError(getErrorMessage(result.body));
      return;
    }

    setError(
      `Failed to create routine (${result.status}): ${getErrorMessage(
        result.body
      )}`
    );
  };

  // 保存は PATCH で更新する。
  const handleUpdate = async (routine: Routine) => {
    setError(null);
    const tasks = normalizeTasks(routine.tasks);
    if (tasks.length === 0) {
      setError("タスクは1件以上入力してください。");
      return;
    }

    await getCsrfCookie();
    const result = await updateRoutine(routine.id, {
      title: routine.title,
      tasks,
    });

    if (result.status === 200) {
      await loadRoutines();
      return;
    }

    if (result.status === 422) {
      setError(getErrorMessage(result.body));
      return;
    }

    setError(
      `Failed to update routine (${result.status}): ${getErrorMessage(
        result.body
      )}`
    );
  };

  // 削除後は一覧を再取得する。
  const handleDelete = async (id: number) => {
    setError(null);
    await getCsrfCookie();
    const result = await deleteRoutine(id);
    if (result.status === 200) {
      await loadRoutines();
      return;
    }

    setError(
      `Failed to delete routine (${result.status}): ${getErrorMessage(
        result.body
      )}`
    );
  };

  if (loading) {
    return <div className="text-sm text-slate-600">Loading...</div>;
  }

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Routines</h1>
      {error ? <div className="text-sm text-slate-600">{error}</div> : null}

      <section className="space-y-3 border border-slate-200 p-4">
        <h2 className="text-sm font-semibold">New routine</h2>
        <label className="text-sm">
          Title
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            className="mt-1 w-full border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <div className="space-y-2">
          <div className="text-sm">Tasks</div>
          {newTasks.map((task, index) => (
            <div key={`new-${index}`} className="flex gap-2">
              <input
                value={task}
                onChange={(event) =>
                  setNewTasks((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item
                    )
                  )
                }
                className="w-full border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                className="border border-slate-200 px-2 text-sm"
                onClick={() =>
                  setNewTasks((prev) =>
                    prev.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
                disabled={newTasks.length <= 1}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="border border-slate-200 px-3 py-2 text-sm"
            onClick={() =>
              setNewTasks((prev) =>
                canAppendTask(prev) ? [...prev, ""] : prev
              )
            }
            disabled={!canAddTask}
          >
            Add task
          </button>
          {isNewTaskLimitReached ? (
            <div className="text-xs text-slate-600">Max 10 tasks.</div>
          ) : null}
        </div>
        <button
          type="button"
          className="border border-slate-200 px-3 py-2 text-sm"
          onClick={handleCreate}
        >
          Save
        </button>
      </section>

      <section className="space-y-4">
        {routines.length === 0 ? (
          <div className="text-sm text-slate-600">No routines yet.</div>
        ) : null}
        {routines.map((routine) => {
          const routineLimitReached = routine.tasks.length >= 10;
          const routineCanAddTask = canAppendTask(routine.tasks);
          return (
            <div key={routine.id} className="space-y-2 border border-slate-200 p-4">
              <div className="text-xs text-slate-600">ID: {routine.id}</div>
              <label className="text-sm">
                Title
                <input
                  value={routine.title}
                  onChange={(event) =>
                    updateRoutineField(routine.id, (current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="mt-1 w-full border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="space-y-2">
                <div className="text-sm">Tasks</div>
                {routine.tasks.map((task, index) => (
                  <div key={`${routine.id}-${index}`} className="flex gap-2">
                    <input
                      value={task}
                      onChange={(event) =>
                        updateRoutineField(routine.id, (current) => ({
                          ...current,
                          tasks: current.tasks.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item
                          ),
                        }))
                      }
                      className="w-full border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      className="border border-slate-200 px-2 text-sm"
                      onClick={() =>
                        updateRoutineField(routine.id, (current) => ({
                          ...current,
                          tasks: current.tasks.filter(
                            (_, itemIndex) => itemIndex !== index
                          ),
                        }))
                      }
                      disabled={routine.tasks.length <= 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="border border-slate-200 px-3 py-2 text-sm"
                  onClick={() =>
                    updateRoutineField(routine.id, (current) => ({
                      ...current,
                      tasks: canAppendTask(current.tasks)
                        ? [...current.tasks, ""]
                        : current.tasks,
                    }))
                  }
                  disabled={!routineCanAddTask}
                >
                  Add task
                </button>
                {routineLimitReached ? (
                  <div className="text-xs text-slate-600">Max 10 tasks.</div>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="border border-slate-200 px-3 py-2 text-sm"
                  onClick={() => handleUpdate(routine)}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="border border-slate-200 px-3 py-2 text-sm"
                  onClick={() => handleDelete(routine.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </section>
  );
}
