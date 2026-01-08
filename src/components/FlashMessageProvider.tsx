"use client";

/**
 * フラッシュメッセージProvider
 * 
 * 責務：
 * - アプリ全体でフラッシュメッセージを管理
 * - 画面上部に固定表示
 * - 自動消滅とキュー管理
 */

import { createContext, useContext, useState, useCallback, useEffect } from "react";
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

  const showFlash = useCallback((type: FlashType, message: string, duration?: number) => {
    const id = `flash-${Date.now()}-${Math.random()}`;
    const newMessage: FlashMessageData = {
      id,
      type,
      message,
      duration,
    };

    // 直前のメッセージを置き換え（キューではなく置き換え方式）
    setMessages([newMessage]);
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  }, []);

  return (
    <FlashContext.Provider value={{ showFlash }}>
      {children}
      {/* フラッシュメッセージを画面上部に表示 */}
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
    </FlashContext.Provider>
  );
}

