"use client";

/**
 * フラッシュメッセージProvider
 * 
 * 責務：
 * - アプリ全体でフラッシュメッセージを管理
 * - 画面上部に固定表示
 * - 自動消滅とキュー管理
 * - 実行中画面（/run/[historyId]）ではフラッシュを抑制（集中を邪魔しない）
 */

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import FlashMessage from "./FlashMessage";

export type FlashType = "success" | "error" | "info";

export interface FlashMessageData {
  id: string;
  type: FlashType;
  message: string;
  duration?: number;
}

interface FlashContextType {
  showFlash: (type: FlashType, message: string, duration?: number) => void;
}

const FlashContext = createContext<FlashContextType | undefined>(undefined);

export function useFlash() {
  const context = useContext(FlashContext);
  if (!context) {
    throw new Error("useFlash must be used within FlashMessageProvider");
  }
  return context;
}

export function FlashMessageProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<FlashMessageData[]>([]);
  const pathname = usePathname();

  // 実行中画面（/run/[historyId]）ではフラッシュを抑制
  // 完了画面（/run/[historyId]/done）は除外（フラッシュを表示する）
  // パターン: /run/数字 で始まり、/done で終わらない
  const isRunningPage = useCallback(() => {
    // /run/ で始まる
    if (!pathname.startsWith("/run/")) {
      return false;
    }
    // /done で終わる場合は除外（完了画面はフラッシュを表示する）
    if (pathname.endsWith("/done")) {
      return false;
    }
    // /run/[historyId] パターン（数字のみ）を実行中画面として判定
    // 例: /run/123 → true, /run/123/done → false（既に除外済み）
    const match = pathname.match(/^\/run\/(\d+)$/);
    return match !== null;
  }, [pathname]);

  const showFlash = useCallback((type: FlashType, message: string, duration?: number) => {
    // 実行中画面ではフラッシュを抑制（集中を邪魔しない）
    if (isRunningPage()) {
      // 技術的詳細はコンソールに出力（ユーザーには見せない）
      console.log(`[Flash suppressed on running page] ${type}: ${message}`);
      return;
    }

    const id = `flash-${Date.now()}-${Math.random()}`;
    const newMessage: FlashMessageData = {
      id,
      type,
      message,
      duration,
    };

    // 直前のメッセージを置き換え（キューではなく置き換え方式）
    setMessages([newMessage]);
  }, [isRunningPage]);

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  }, []);

  return (
    <FlashContext.Provider value={{ showFlash }}>
      {children}
      {/* フラッシュメッセージを画面上部に表示（実行中画面では表示しない） */}
      {!isRunningPage() && (
        <div className="flash-message-container">
          {messages.map((message) => (
            <FlashMessage
              key={message.id}
              id={message.id}
              type={message.type}
              message={message.message}
              duration={message.duration}
              onClose={() => removeMessage(message.id)}
            />
          ))}
        </div>
      )}
    </FlashContext.Provider>
  );
}

