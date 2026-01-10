"use client";

// 実行前確認画面。並び替えはここでのみ行い、他画面に混ぜない。
// 実行開始時に履歴を作成し /run/[historyId] へ遷移する。

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  getCsrfCookie,
  getRoutine,
  startHistory,
  updateRoutine,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import LoadingSpinner from "@/components/LoadingSpinner";

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

// ソート可能なタスクアイテムコンポーネント
function SortableTaskItem({
  id,
  task,
  activeId,
}: {
  id: string;
  task: string;
  activeId: string | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  // ドラッグ中またはドラッグ終了直後はアニメーションを無効化して、即座に反映させる
  // activeId が null でない場合は、まだドラッグ処理中なのでアニメーションを無効化
  const shouldAnimate = !isDragging && activeId === null;

  const style = {
    transform: CSS.Transform.toString(transform),
    // アニメーションを制御: ドラッグ中やドラッグ終了直後は無効化、それ以外は即座に反映
    transition: shouldAnimate ? transition : 'none',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`preflight-task-card ${isDragging ? "preflight-task-card-dragging" : ""}`}
    >
      {/* タスク名 */}
      <div className="preflight-task-name">{task}</div>
      {/* ドラッグハンドル（ドットアイコン）: 右側に配置（右利き配慮） */}
      <div
        className="preflight-task-drag-handle"
        {...attributes}
        {...listeners}
        aria-label="ドラッグして順番を変更"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ color: "var(--fg)" }}
        >
          <circle cx="6" cy="6" r="1.5" fill="currentColor" />
          <circle cx="10" cy="6" r="1.5" fill="currentColor" />
          <circle cx="14" cy="6" r="1.5" fill="currentColor" />
          <circle cx="6" cy="10" r="1.5" fill="currentColor" />
          <circle cx="10" cy="10" r="1.5" fill="currentColor" />
          <circle cx="14" cy="10" r="1.5" fill="currentColor" />
          <circle cx="6" cy="14" r="1.5" fill="currentColor" />
          <circle cx="10" cy="14" r="1.5" fill="currentColor" />
          <circle cx="14" cy="14" r="1.5" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

export default function PreflightPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { status, me } = useAuth();
  const { isSubmitting, submitGuard } = useSubmitGuard();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [tasks, setTasks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  const routineId = useMemo(() => Number(params?.id), [params?.id]);

  // 認証判定は /api/me の成否で統一する。
  useEffect(() => {
    void me();
  }, [me]);

  // 未認証の遷移はガードに一本化する。

  // スクロール状態を監視して、下部固定エリアのシャドウを制御
  useEffect(() => {
    const handleScroll = () => {
      // windowのスクロール位置を確認
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setIsScrolled(scrollTop > 0);
    };

    // スクロールイベントを監視
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // 初期状態を確認

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

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

  // ドラッグ&ドロップ用のセンサー設定（マウス・タッチ両対応）
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ドラッグ開始時のハンドラ
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // ドラッグ終了時のハンドラ
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // データを即座に更新（アニメーションを待たない）
      setTasks((items) => {
        const oldIndex = items.findIndex((_, i) => `task-${i}` === active.id);
        const newIndex = items.findIndex((_, i) => `task-${i}` === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }

    // activeId を null にすることで、アニメーションを再開
    // requestAnimationFrame を使って、DOM更新が確実に反映されてからアニメーションを再開
    requestAnimationFrame(() => {
      setActiveId(null);
    });
  };

  const handleStart = submitGuard(async () => {
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
      // 技術的詳細はコンソールに出力（ユーザーには見せない）
      console.error("Update routine failed:", updateResult.status, updateResult.body);
      setError("処理に失敗しました。もう一度お試しください。");
      return;
    }

    // 開始は履歴 API を起点にし、historyId を受け取って遷移する。
    const startResult = await startHistory(routine.id);
    if (startResult.status === 201) {
      const parsed = parseJson<{ data: History & { started_at?: string } }>(
        startResult.body
      );
      const historyId = parsed?.data?.id;
      const startedAt = parsed?.data?.started_at ?? null;
      if (!historyId) {
        setError("データが見つかりません。");
        return;
      }

      // /run 側でタスクを参照できるよう、historyId 単位で保存する。
      sessionStorage.setItem(
        `run:${historyId}`,
        JSON.stringify({ title: routine.title, tasks, started_at: startedAt })
      );

      router.push(`/run/${historyId}`);
      return;
    }

    // 技術的詳細はコンソールに出力（ユーザーには見せない）
    console.error("Start history failed:", startResult.status, startResult.body);
    setError("処理に失敗しました。もう一度お試しください。");
  });

  if (error) {
    return <div className="rm-muted text-sm">{error}</div>;
  }

  if (!routine) {
    return <LoadingSpinner />;
  }

  // ソート可能なアイテムのID配列
  const taskIds = tasks.map((_, index) => `task-${index}`);

  // 動的な見出し文言を生成（リスト名が取得できている場合は「（リスト名）を始める」、それ以外はフォールバック）
  const pageTitle = routine?.title
    ? `「${routine.title}」を始めます`
    : "このリストを始めます";

  return (
    <section className="preflight-container">
      {/* 戻るボタン: 上部に配置（誤タップを防ぐ、作成/編集画面と統一） */}
      <button
        type="button"
        className="preflight-back-btn-top"
        onClick={() => router.push("/routines")}
      >
        ← 戻る
      </button>

      <h1 className="preflight-title">{pageTitle}</h1>

      {/* 並べ替え説明文 */}
      <p className="preflight-description">
        タスクはドラッグして順番を並べ替えできます
      </p>

      {/* ドラッグ&ドロップコンテキスト */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="preflight-task-list">
            {tasks.map((task, index) => (
              <SortableTaskItem
                key={`task-${index}`}
                id={`task-${index}`}
                task={task}
                activeId={activeId}
              />
            ))}
          </div>
        </SortableContext>
        {/* ドラッグ中のオーバーレイ（視覚的フィードバック） */}
        <DragOverlay>
          {activeId ? (() => {
            // activeIdからindexを抽出（"task-0" -> 0）
            const index = parseInt(activeId.replace("task-", ""), 10);
            const task = tasks[index];
            return task ? (
              <div className="preflight-task-card preflight-task-card-overlay">
                <div className="preflight-task-name">{task}</div>
                <div className="preflight-task-drag-handle">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ color: "var(--fg)" }}
                  >
                    <circle cx="6" cy="6" r="1.5" fill="currentColor" />
                    <circle cx="10" cy="6" r="1.5" fill="currentColor" />
                    <circle cx="14" cy="6" r="1.5" fill="currentColor" />
                    <circle cx="6" cy="10" r="1.5" fill="currentColor" />
                    <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                    <circle cx="14" cy="10" r="1.5" fill="currentColor" />
                    <circle cx="6" cy="14" r="1.5" fill="currentColor" />
                    <circle cx="10" cy="14" r="1.5" fill="currentColor" />
                    <circle cx="14" cy="14" r="1.5" fill="currentColor" />
                  </svg>
                </div>
              </div>
            ) : null;
          })() : null}
        </DragOverlay>
      </DndContext>

      {/* アクションボタン: 下部固定（開始するを最優先Primary、作成/編集画面と統一） */}
      <div
        ref={actionsRef}
        className={`preflight-actions ${isScrolled ? "scrolled" : ""}`}
      >
        <div className="preflight-actions-inner">
          <button
            type="button"
            className="rm-btn rm-btn-primary preflight-start-btn"
            onClick={handleStart}
            disabled={isSubmitting}
          >
            {isSubmitting ? "開始中..." : "開始する"}
          </button>
        </div>
      </div>
    </section>
  );
}
