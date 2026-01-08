"use client";

// ルーティン作成専用画面。入力と追加のみを担い、一覧や並び替えは持たせない。
// Phase 4 以降の機能追加を想定し、最小の保存フローだけ先に固める。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createRoutine, getCsrfCookie, type RoutinePayload } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useFlash } from "@/components/FlashMessageProvider";

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
  const { showFlash } = useFlash();
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
      setLimitMessage("タスクは最大10個までです");
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
      showFlash("success", "リストを作成しました");
      router.push("/routines");
      return;
    }

    if (result.status === 422) {
      setError("入力内容を確認してください。");
      showFlash("error", "入力内容を確認してください。");
      return;
    }

    setError(`保存に失敗しました (${result.status})`);
    showFlash("error", `保存に失敗しました (${result.status})`);
  };

  return (
    <section className="routine-form-container">
      {/* 戻るボタン: 上部に配置（誤タップを防ぐ） */}
      <button
        type="button"
        className="routine-form-back-btn"
        onClick={() => router.push("/routines")}
      >
        ← 戻る
      </button>
      <h1 className="routine-form-title">新しいタスクリストを作る</h1>
      {error ? <div className="routine-form-error">{error}</div> : null}

      {/* リスト名: 先頭に配置、余白をしっかり取る */}
      <label className="routine-form-label">
        リスト名
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="routine-form-input"
          placeholder="例: 朝のルーティン"
        />
      </label>

      {/* タスク入力: 各タスクは縦に並べる */}
      <div className="routine-form-tasks">
        <div className="routine-form-label-text">タスク</div>
        {tasks.map((task, index) => (
          <div key={`new-${index}`} className="routine-form-task-row">
            <input
              value={task}
              onChange={(event) =>
                setTasks((prev) =>
                  prev.map((item, itemIndex) =>
                    itemIndex === index ? event.target.value : item
                  )
                )
              }
              className="routine-form-input"
              placeholder="タスクを入力"
            />
            <button
              type="button"
              className="routine-form-delete-btn"
              onClick={() =>
                setTasks((prev) =>
                  prev.filter((_, itemIndex) => itemIndex !== index)
                )
              }
              disabled={tasks.length <= 1}
              aria-label="削除"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
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
        ))}
        <button
          type="button"
          className="rm-btn routine-form-add-btn"
          onClick={handleAddTask}
          disabled={tasks.length >= 10}
        >
          ＋ タスクを追加する
        </button>
        {limitMessage ? (
          <div className="routine-form-limit-message">{limitMessage}</div>
        ) : null}
      </div>

      {/* アクションボタン: 下部固定バー（保存するを最優先Primary） */}
      <div className="routine-form-actions">
        <button
          type="button"
          className="rm-btn rm-btn-primary routine-form-save-btn"
          onClick={handleSave}
        >
          保存する
        </button>
      </div>
    </section>
  );
}
