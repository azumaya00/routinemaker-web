"use client";

// Phase 2.5 でのホームは認証状態と /api/me の内容を確認するための枠。
// Phase 3 以降でルーティン一覧などに置き換える前提。

import { useEffect } from "react";

import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const { status, user, error, me } = useAuth();

  useEffect(() => {
    void me();
  }, [me]);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Home</h1>
      <div className="text-sm text-slate-600">
        Status: {status}
      </div>
      {error ? (
        <div className="text-sm text-slate-600">Error: {error}</div>
      ) : null}
      <button
        type="button"
        className="rounded border border-slate-200 px-3 py-2 text-sm"
        onClick={() => void me()}
      >
        Refresh /api/me
      </button>
      <pre className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
        {JSON.stringify(user, null, 2)}
      </pre>
    </section>
  );
}
