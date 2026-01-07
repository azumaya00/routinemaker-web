// 一時的なデバッグログを画面遷移後も参照できるよう保持する。
// 本番導入前に削除できるよう、小さなユーティリティとして隔離する。

const STORAGE_KEY = "rm_debug_logs";

type DebugEntry = {
  message: string;
  at: string;
};

export const appendDebugLog = (message: string) => {
  if (typeof window === "undefined") {
    return;
  }
  const current = readDebugLogs();
  current.push({ message, at: new Date().toISOString() });
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current.slice(-50)));
};

export const readDebugLogs = (): DebugEntry[] => {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as DebugEntry[];
  } catch {
    return [];
  }
};

export const clearDebugLogs = () => {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.removeItem(STORAGE_KEY);
};
