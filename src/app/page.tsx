"use client";

// ログイン前のファーストビュー。要件のコピーとCTAだけを置く。
// ログイン済みは /routines に寄せ、一覧や作成 UI はここに出さない。

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { clearDebugLogs, readDebugLogs } from "@/lib/debug";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, me } = useAuth();
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const showDebug = useMemo(
    () => searchParams.get("debug") === "1",
    [searchParams]
  );

  useEffect(() => {
    if (!showDebug) {
      return;
    }
    const lines = readDebugLogs().map((entry) => `${entry.at} ${entry.message}`);
    setDebugLines(lines);
  }, [showDebug]);

  useEffect(() => {
    void me();
  }, [me]);

  // 認証済みはホームではなく /routines を入口にする。
  useEffect(() => {
    if (status === "authenticated" && !showDebug) {
      router.push("/routines");
    }
  }, [status, showDebug, router]);

  // 認証状態の確定までは表示を出さず、ログイン直後のちらつきを防ぐ。
  if (status === "loading") {
    return null;
  }

  // 認証済みは遷移のみ行い、この画面は表示しない。
  if (status === "authenticated" && !showDebug) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">
        今やる「ひとつ」だけに集中しよう
      </h1>
      <div className="text-sm text-slate-600">
        やることが多いと止まってしまう人のための、タスク管理アプリ
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="border border-slate-200 px-3 py-2 text-sm"
          onClick={() => router.push("/signup")}
        >
          無料で使う
        </button>
        <button
          type="button"
          className="border border-slate-200 px-3 py-2 text-sm"
          onClick={() => router.push("/login")}
        >
          Googleで続ける
        </button>
      </div>
      {showDebug ? (
        <div className="space-y-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <div className="font-semibold">Debug Logs</div>
            <button
              type="button"
              className="rounded border border-slate-200 px-2 py-1"
              onClick={() => {
                clearDebugLogs();
                setDebugLines([]);
              }}
            >
              Clear
            </button>
          </div>
          <pre className="whitespace-pre-wrap">{debugLines.join("\n")}</pre>
        </div>
      ) : null}
    </section>
  );
}
