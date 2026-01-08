"use client";

/**
 * 二重実行ガード用の共通hook
 * 
 * 責務：
 * - APIリクエスト中の二重実行を防ぐ
 * - ボタンのdisabled状態を管理
 * - 成功/失敗時に必ず状態をリセット（finally）
 * 
 * 使用例：
 * const { isSubmitting, submitGuard } = useSubmitGuard();
 * 
 * const handleSave = submitGuard(async () => {
 *   const result = await apiCall();
 *   if (result.status === 200) {
 *     // 成功処理
 *   }
 * });
 */

import { useCallback, useRef, useState } from "react";

export function useSubmitGuard() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false); // 二重実行防止用のref

  const submitGuard = useCallback(
    <T,>(fn: () => Promise<T>): (() => Promise<T | void>) => {
      return async () => {
        // 既に実行中の場合は何もしない
        if (isSubmittingRef.current) {
          return;
        }

        isSubmittingRef.current = true;
        setIsSubmitting(true);

        try {
          return await fn();
        } finally {
          // 成功/失敗に関わらず必ず状態をリセット
          isSubmittingRef.current = false;
          setIsSubmitting(false);
        }
      };
    },
    []
  );

  return { isSubmitting, submitGuard };
}
