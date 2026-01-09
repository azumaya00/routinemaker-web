"use client";

/**
 * 削除確認ダイアログコンポーネント
 * 
 * 責務：
 * - 削除などの危険な操作の前に確認を求める
 * - フォーカストラップとアクセシビリティを確保
 * - 既存デザイン（角丸、青系ボタン、余白感）と統一
 * - 中央モーダルとして表示（portal使用）
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: "destructive" | "default";
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  loading?: boolean;
  children?: React.ReactNode; // カスタムコンテンツ（パスワード入力欄など）
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmVariant = "default",
  onConfirm,
  onCancel,
  loading = false,
  children,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // スクロールロック: ダイアログ表示中はbodyのスクロールを禁止
  useEffect(() => {
    if (!open) return;

    // 現在のスクロール位置を保存
    const scrollY = window.scrollY;
    // bodyにスクロールロック用のスタイルを適用
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      // スクロールロックを解除
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      // スクロール位置を復元
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  // Escキーで閉じる
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, loading, onCancel]);

  // 初期フォーカスをキャンセルボタンに設定
  useEffect(() => {
    if (open && cancelButtonRef.current) {
      // 少し遅延を入れて確実にフォーカスを当てる
      const timer = setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // フォーカストラップ（Tabキーでダイアログ内を循環）
  useEffect(() => {
    if (!open || !dialogRef.current) return;

    const dialog = dialogRef.current;
    const focusableElements = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    dialog.addEventListener("keydown", handleTab);
    return () => {
      dialog.removeEventListener("keydown", handleTab);
    };
  }, [open]);

  // オーバーレイクリックで閉じる（ダイアログ本体をクリックした場合は閉じない）
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // ダイアログ本体をクリックした場合は閉じない
    if (e.target === e.currentTarget && !loading) {
      onCancel();
    }
  };

  // ダイアログ本体のクリックイベントを止める（オーバーレイへの伝播を防ぐ）
  const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  if (!open) return null;

  // Portalを使用してbody直下に表示（コンテナのレイアウトに影響されないようにする）
  const dialogContent = (
    <>
      {/* オーバーレイ: 背景を暗くする（クリックで閉じる） */}
      <div
        className="confirm-dialog-overlay"
        aria-hidden="true"
        onClick={handleOverlayClick}
      />
      
      {/* ダイアログ本体 */}
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? "confirm-dialog-description" : undefined}
        onClick={handleDialogClick}
      >
        {/* タイトル */}
        <h2 id="confirm-dialog-title" className="confirm-dialog-title">
          {title}
        </h2>
        
        {/* 説明文（オプション） */}
        {description && (
          <p id="confirm-dialog-description" className="confirm-dialog-description">
            {description}
          </p>
        )}
        
        {/* カスタムコンテンツ（パスワード入力欄など） */}
        {children && (
          <div className="confirm-dialog-content">
            {children}
          </div>
        )}
        
        {/* ボタン群 */}
        <div className="confirm-dialog-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="rm-btn confirm-dialog-cancel"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className={`rm-btn confirm-dialog-confirm ${
              confirmVariant === "destructive" ? "confirm-dialog-confirm-destructive" : ""
            }`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "処理中..." : confirmLabel}
          </button>
        </div>
      </div>
    </>
  );

  // Portalでbody直下に表示（ブラウザ環境でのみ実行）
  if (typeof window === "undefined") {
    return null;
  }

  return createPortal(dialogContent, document.body);
}

