"use client";

// ルーティン作成専用画面。入力と追加のみを担い、一覧や並び替えは持たせない。
// Phase 4 以降の機能追加を想定し、最小の保存フローだけ先に固める。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createRoutine, getCsrfCookie, type RoutinePayload } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const normalizeTasks = (tasks: string[]) =>
  tasks.map((task) => task.trim()).filter((task) => task.length > 0);

const canAppendTask = (tasks: string[]) => {
  if (tasks.length >= 10) {
    return false;
  }

  const last = tasks[tasks.length - 1] ?? "";
  return last.trim().length > 0;
};

export default function RoutineNewPage() {
  const router = useRouter();
  const { me } = useAuth();
  const [title, setTitle] = useState("");
  const [tasks, setTasks] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  // 作成画面も /api/me で認証判定を揃える。
  useEffect(() => {
    void me();
  }, [me]);

  // 未認証の遷移はガード側で統一する。

  // 上限に到達していない場合は警告を出し続けない。
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
    setError(null);
    const normalized = normalizeTasks(tasks);
    if (normalized.length === 0) {
      setError("タスクは1件以上入力してください。");
      return;
    }

    const payload: RoutinePayload = {
      title,
      tasks: normalized,
    };

    // 作成は CSRF → POST → /routines へ戻す。
    await getCsrfCookie();
    const result = await createRoutine(payload);
    if (result.status === 201) {
      router.push("/routines");
      return;
    }

    if (result.status === 422) {
      setError("入力内容を確認してください。");
      return;
    }

    setError(`保存に失敗しました (${result.status})`);
  };

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">新しく作る</h1>
      {error ? <div className="rm-muted text-sm">{error}</div> : null}

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
          <div key={`new-${index}`} className="flex gap-2">
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
