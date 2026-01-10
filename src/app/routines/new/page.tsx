"use client";

// ルーティン作成専用画面。入力と追加のみを担い、一覧や並び替えは持たせない。
// Phase 4 以降の機能追加を想定し、最小の保存フローだけ先に固める。

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

import { createRoutine, getCsrfCookie, type RoutinePayload } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { useFlash } from "@/components/FlashMessageProvider";

const normalizeTasks = (tasks: string[]) =>
  tasks.map((task) => task.trim()).filter((task) => task.length > 0);

/**
 * タスク追加可能かどうかを判定（planに応じて制限を分岐）
 * 
 * @param tasks - 現在のタスク配列
 * @param plan - ユーザーのプラン（'unlimited'の場合は制限なし）
 * @returns 追加可能な場合true
 */
const canAppendTask = (tasks: string[], plan?: string) => {
  // unlimitedユーザーは制限なし
  if (plan === 'unlimited') {
    const last = tasks[tasks.length - 1] ?? "";
    return last.trim().length > 0;
  }

  // free/future_proユーザーは10件制限
  if (tasks.length >= 10) {
    return false;
  }

  const last = tasks[tasks.length - 1] ?? "";
  return last.trim().length > 0;
};

export default function RoutineNewPage() {
  const router = useRouter();
  const { me, user } = useAuth();
  const { showFlash } = useFlash();
  const { isSubmitting, submitGuard } = useSubmitGuard();
  const [title, setTitle] = useState("");
  const [tasks, setTasks] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  // 各タスク入力欄の参照を保持（Enterキーで追加後にフォーカスを移すため）
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 作成画面も /api/me で認証判定を揃える。
  useEffect(() => {
    void me();
  }, [me]);

  // 未認証の遷移はガード側で統一する。

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

  // 上限に到達していない場合は警告を出し続けない。
  // unlimitedユーザーの場合は常に警告を消す（制限がないため）
  useEffect(() => {
    if (user?.plan === 'unlimited' || tasks.length < 10) {
      setLimitMessage(null);
    }
  }, [tasks.length, limitMessage, user?.plan]);

  /**
   * タスク追加処理（単一の入口）
   * ボタンとEnterキーの両方から呼ばれる
   * 
   * @param currentTaskValue - 現在の入力欄の値（Enterキーから呼ばれる場合に使用）
   * @param shouldFocusNext - 追加後に次の入力欄にフォーカスを移すかどうか（Enterキーから呼ばれる場合）
   */
  const handleAddTask = (
    currentTaskValue?: string,
    shouldFocusNext: boolean = false
  ) => {
    // planに応じた制限チェック
    const isUnlimited = user?.plan === 'unlimited';
    
    // free/future_proユーザーの場合のみ10件制限を適用
    if (!isUnlimited && tasks.length >= 10) {
      setLimitMessage("タスクは最大10個までです");
      return;
    }

    // Enterキーから呼ばれた場合: 現在の入力欄の値をチェック
    if (currentTaskValue !== undefined) {
      const trimmed = currentTaskValue.trim();
      // 空入力や空白のみの場合は追加しない
      if (trimmed.length === 0) {
        return;
      }
    } else {
      // ボタンから呼ばれた場合: planに応じたロジック（最後のタスクが空でないことをチェック）
      if (!canAppendTask(tasks, user?.plan)) {
        return;
      }
    }

    setLimitMessage(null);
    const nextIndex = tasks.length; // 追加後の新しいタスクのインデックス
    setTasks((prev) => [...prev, ""]);

    // Enterキーから呼ばれた場合: 追加後に新しい入力欄にフォーカスを移す
    if (shouldFocusNext) {
      // 次のフレームでフォーカスを移す（状態更新後にDOMが更新されるのを待つ）
      setTimeout(() => {
        const nextInput = inputRefs.current[nextIndex];
        if (nextInput) {
          nextInput.focus();
        }
      }, 0);
    }
  };

  /**
   * Enterキーでタスクを追加するハンドラー
   * IME変換中は誤発火しないようにする
   * 
   * @param event - キーボードイベント
   * @param index - 現在のタスクのインデックス
   */
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    // Enterキー以外は何もしない
    if (event.key !== "Enter") {
      return;
    }

    // IME変換中のEnterは無視（最重要）
    // isComposing: IME変換中かどうか
    // keyCode === 229: IME変換中のEnter（保険）
    // shiftKey: Shift+Enterは将来の複数行入力に備えて無視
    if (
      event.nativeEvent.isComposing === true ||
      (event.nativeEvent as any).keyCode === 229 ||
      event.shiftKey === true
    ) {
      return;
    }

    // フォームsubmitのデフォルト動作を防ぐ
    event.preventDefault();

    // 現在の入力欄の値を取得
    const currentValue = tasks[index] ?? "";
    const trimmed = currentValue.trim();

    // 空入力や空白のみの場合は追加しない（handleAddTask内でもチェックするが、ここでも早期リターン）
    if (trimmed.length === 0) {
      return;
    }

    // 追加処理を実行（Enterキーから呼ばれた場合は、追加後に次の入力欄にフォーカスを移す）
    handleAddTask(currentValue, true);
  };

  const handleSave = submitGuard(async () => {
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
      // APIからメッセージが返ってきた場合はそれを使用、なければデフォルトメッセージ
      try {
        const parsed = JSON.parse(result.body) as { message?: string };
        const message = parsed.message || "入力内容を確認してください。";
        setError(message);
        showFlash("error", message);
      } catch {
        setError("入力内容を確認してください。");
        showFlash("error", "入力内容を確認してください。");
      }
      return;
    }

    // 403の場合も同様にメッセージを表示
    if (result.status === 403) {
      try {
        const parsed = JSON.parse(result.body) as { message?: string };
        const message = parsed.message || "この操作は許可されていません。";
        setError(message);
        showFlash("error", message);
      } catch {
        setError("この操作は許可されていません。");
        showFlash("error", "この操作は許可されていません。");
      }
      return;
    }

    // 技術的詳細はコンソールに出力（ユーザーには見せない）
    console.error("Create routine failed:", result.status, result.body);
    setError("保存に失敗しました。もう一度お試しください。");
    showFlash("error", "保存に失敗しました。もう一度お試しください。");
  });

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
              ref={(el) => {
                // 各入力欄の参照を保持（Enterキーで追加後にフォーカスを移すため）
                inputRefs.current[index] = el;
              }}
              value={task}
              onChange={(event) =>
                setTasks((prev) =>
                  prev.map((item, itemIndex) =>
                    itemIndex === index ? event.target.value : item
                  )
                )
              }
              onKeyDown={(event) => handleKeyDown(event, index)}
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
                fill="currentColor"
              >
                <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 4h12v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7Zm4 2v8h2V9H10Zm4 0v8h2V9h-2Z" />
              </svg>
            </button>
          </div>
        ))}
        <button
          type="button"
          className="rm-btn routine-form-add-btn"
          onClick={() => handleAddTask()}
          // unlimitedユーザーは制限なし、それ以外は10件でdisable
          disabled={user?.plan !== 'unlimited' && tasks.length >= 10}
        >
          ＋ タスクを追加する
        </button>
        {limitMessage ? (
          <div className="routine-form-limit-message">{limitMessage}</div>
        ) : null}
      </div>

      {/* アクションボタン: 下部固定バー（保存するを最優先Primary） */}
      <div
        ref={actionsRef}
        className={`routine-form-actions ${isScrolled ? "scrolled" : ""}`}
      >
        <div className="routine-form-actions-inner">
          <button
            type="button"
            className="rm-btn rm-btn-primary routine-form-save-btn"
            onClick={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? "保存中..." : "保存する"}
          </button>
        </div>
      </div>
    </section>
  );
}
