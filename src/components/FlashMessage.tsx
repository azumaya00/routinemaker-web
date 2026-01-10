"use client";

/**
 * フラッシュメッセージコンポーネント
 * 
 * 責務：
 * - 操作結果を画面上部に表示
 * - 自動消滅と手動閉じる機能
 * - 既存デザイン（角丸、軽い影、アイコン付き）と統一
 */

import { useEffect, useState } from "react";
import type { FlashType } from "./FlashMessageProvider";

interface FlashMessageProps {
  id: string;
  type: FlashType;
  message: string;
  duration?: number;
  onClose: () => void;
}

export default function FlashMessage({
  type,
  message,
  duration,
  onClose,
}: FlashMessageProps) {
  const [isVisible, setIsVisible] = useState(false);

  // 表示アニメーション
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // 自動消滅
  // 成功は短く控えめに（1.5秒）、エラーは現状維持（4秒）
  useEffect(() => {
    const defaultDuration = type === "success" ? 1500 : type === "error" ? 4000 : 2500;
    const timeout = duration ?? defaultDuration;
    const timer = setTimeout(() => {
      setIsVisible(false);
      // アニメーション完了後に削除
      setTimeout(onClose, 300);
    }, timeout);
    return () => clearTimeout(timer);
  }, [type, duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`flash-message flash-message-${type} ${isVisible ? "flash-message-visible" : ""}`}
      role="alert"
      aria-live="polite"
    >
      {/* アイコン */}
      <div className="flash-message-icon">
        {type === "success" ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="var(--fg)">
            <circle cx="12" cy="12" r="12" fill="var(--fg)" />
            <path d="M7 12.5 10.5 16l7-8L19 10l-8.5 10L5 14z" fill="var(--bg)" />
          </svg>
        ) : type === "error" ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="var(--fg)">
            <circle cx="12" cy="12" r="12" fill="var(--fg)" />
            <path d="M11 6h2v8h-2zM11 16h2v2h-2z" fill="var(--bg)" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="var(--fg)">
            <circle cx="12" cy="12" r="12" fill="var(--fg)" />
            <path d="M11 8h2v6h-2zM11 15h2v2h-2z" fill="var(--bg)" />
          </svg>
        )}
      </div>
      
      {/* メッセージ */}
      <div className="flash-message-text">{message}</div>
      
      {/* 閉じるボタン（エラー時のみ表示） */}
      {type === "error" && (
        <button
          type="button"
          className="flash-message-close"
          onClick={handleClose}
          aria-label="閉じる"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="var(--fg)">
            <path d="M5 4h4l3 3 3-3h4v4l-3 3 3 3v4h-4l-3-3-3 3H5v-4l3-3-3-3Z" />
          </svg>
        </button>
      )}
    </div>
  );
}

