"use client";

// ツールチップコンポーネント
// PC: hoverで表示、フォーカスでも表示
// Mobile: タップで表示、外側タップで閉じる
// アクセシビリティ配慮: aria-label、キーボード操作対応

import { useEffect, useRef, useState } from "react";

type TooltipProps = {
  content: string;
  children: React.ReactNode;
  position?: "bottom" | "right" | "left" | "top";
};

export default function Tooltip({
  content,
  children,
  position = "bottom",
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // ツールチップの位置を計算（画面端で収まるように調整）
  const updateTooltipPosition = () => {
    if (!triggerRef.current || !tooltipRef.current) {
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;

    switch (position) {
      case "bottom":
        top = triggerRect.bottom + 8;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        // 右端にはみ出す場合は左に調整
        if (left + tooltipRect.width > viewportWidth - 16) {
          left = viewportWidth - tooltipRect.width - 16;
        }
        // 左端にはみ出す場合は右に調整
        if (left < 16) {
          left = 16;
        }
        break;
      case "right":
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        left = triggerRect.right + 8;
        // 下端にはみ出す場合は上に調整
        if (top + tooltipRect.height > viewportHeight - 16) {
          top = viewportHeight - tooltipRect.height - 16;
        }
        break;
      case "left":
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        left = triggerRect.left - tooltipRect.width - 8;
        // 下端にはみ出す場合は上に調整
        if (top + tooltipRect.height > viewportHeight - 16) {
          top = viewportHeight - tooltipRect.height - 16;
        }
        break;
      case "top":
        top = triggerRect.top - tooltipRect.height - 8;
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        // 右端にはみ出す場合は左に調整
        if (left + tooltipRect.width > viewportWidth - 16) {
          left = viewportWidth - tooltipRect.width - 16;
        }
        // 左端にはみ出す場合は右に調整
        if (left < 16) {
          left = 16;
        }
        break;
    }

    setTooltipPosition({ top, left });
  };

  // ツールチップが開いた時に位置を計算
  useEffect(() => {
    if (isOpen) {
      // 少し遅延させてから位置を計算（DOM更新を待つ）
      setTimeout(() => {
        updateTooltipPosition();
      }, 0);
    }
  }, [isOpen, position]);

  // 外側クリックで閉じる（Mobile対応）
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        tooltipRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        !tooltipRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // キーボード操作対応（Enter/Spaceで開閉）
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen(!isOpen);
    }
    if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={triggerRef}
      className="tooltip-trigger"
      onMouseEnter={() => setIsOpen(true)} // PC: hoverで表示
      onMouseLeave={() => setIsOpen(false)} // PC: hover解除で非表示
      onFocus={() => setIsOpen(true)} // フォーカスで表示
      onBlur={() => setIsOpen(false)} // フォーカス解除で非表示
      onClick={() => setIsOpen(!isOpen)} // Mobile: タップで開閉
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`ヘルプ: ${content}`}
    >
      {children}
      {isOpen && (
        <div
          ref={tooltipRef}
          className="tooltip-content"
          style={
            tooltipPosition
              ? {
                  position: "fixed",
                  top: `${tooltipPosition.top}px`,
                  left: `${tooltipPosition.left}px`,
                  zIndex: 1000,
                }
              : { display: "none" }
          }
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
}
