"use client";

// ログイン後ホーム。ルーティン一覧と導線のみを置き、編集系は別画面に分離する。
// Phase 4 までの責務は「一覧」「新規作成導線」「実行導線」に限定する。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { deleteRoutine, getCsrfCookie, listRoutines } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

type Routine = {
  id: number;
  title: string;
  tasks: string[];
};

const parseJson = <T,>(input: string): T | null => {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
};

export default function RoutinesPage() {
  const router = useRouter();
  const { status, me } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 認証判定は /api/me の成否だけを使う方針。
  useEffect(() => {
    void me();
  }, [me]);

  // 未認証の遷移はガード側で統一する。

  // 一覧は /routines でのみ取得する前提。
  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    setError(null);
    setLoading(true);
    void listRoutines().then((result) => {
      if (result.status === 200) {
        const parsed = parseJson<{ data: Routine[] }>(result.body);
        setRoutines(parsed?.data ?? []);
        setLoading(false);
        return;
      }

      if (result.status === 401) {
        void me();
        return;
      }

      setError(`一覧取得に失敗しました (${result.status})`);
      setLoading(false);
    });
  }, [status, router, me]);

  const handleDelete = async (id: number) => {
    // 削除は一覧画面で許可するが、詳細編集は別画面に寄せる方針。
    setError(null);
    await getCsrfCookie();
    const result = await deleteRoutine(id);
    if (result.status === 200) {
      const refreshed = await listRoutines();
      if (refreshed.status === 200) {
        const parsed = parseJson<{ data: Routine[] }>(refreshed.body);
        setRoutines(parsed?.data ?? []);
      }
      return;
    }

    setError(`削除に失敗しました (${result.status})`);
  };

  if (loading) {
    return <div className="text-sm text-slate-600">Loading...</div>;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">今日は、何から始めますか？</h1>
      {error ? <div className="text-sm text-slate-600">{error}</div> : null}

      <div className="flex gap-2">
        <button
          type="button"
          className="border border-slate-200 px-3 py-2 text-sm"
          onClick={() => router.push("/routines/new")}
        >
          + 新しく作る
        </button>
      </div>

      <section className="space-y-2">
        {routines.length === 0 ? (
          <div className="text-sm text-slate-600">No routines yet.</div>
        ) : null}
        {routines.map((routine) => (
          <div
            key={routine.id}
            className="flex items-center justify-between border border-slate-200 p-3"
          >
            <div className="text-sm">{routine.title}</div>
            <div className="flex gap-2">
              <button
                type="button"
                className="border border-slate-200 px-3 py-1 text-sm"
                onClick={() =>
                  router.push(`/routines/${routine.id}/preflight`)
                }
              >
                実行へ
              </button>
              <button
                type="button"
                className="border border-slate-200 px-3 py-1 text-sm"
                onClick={() => router.push(`/routines/${routine.id}`)}
              >
                編集
              </button>
              <button
                type="button"
                className="border border-slate-200 px-3 py-1 text-sm"
                onClick={() => void handleDelete(routine.id)}
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </section>
    </section>
  );
}
