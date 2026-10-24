import { and, desc, eq } from "drizzle-orm";
import type { Hono } from "hono";
import type { Db } from "../db/client";
import { histories, type HistoryRow } from "../db/schema";
import { jsonError } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";
import { findOwnRoutine } from "./routines";

async function findOwnHistory(db: Db, userId: number, idParam: string): Promise<HistoryRow | null> {
  if (!/^\d+$/.test(idParam)) {
    return null;
  }
  const id = Number(idParam);
  if (!Number.isSafeInteger(id)) {
    return null;
  }
  const [history] = await db.select().from(histories)
    .where(and(eq(histories.id, id), eq(histories.userId, userId)))
    .limit(1);
  return history ?? null;
}

function historyResponse(history: HistoryRow) {
  return {
    id: history.id,
    user_id: history.userId,
    routine_id: history.routineId,
    title: history.title,
    tasks: history.tasks,
    started_at: history.startedAt.toISOString(),
    finished_at: history.finishedAt?.toISOString() ?? null,
    completed: history.completed,
    created_at: history.createdAt?.toISOString() ?? null,
    updated_at: history.updatedAt?.toISOString() ?? null,
  };
}

function detailResponse(history: HistoryRow) {
  return {
    id: history.id,
    routine_id: history.routineId,
    title: history.title,
    tasks: history.tasks,
    started_at: history.startedAt.toISOString(),
    finished_at: history.finishedAt?.toISOString() ?? null,
    completed: history.completed,
    created_at: history.createdAt?.toISOString() ?? null,
    updated_at: history.updatedAt?.toISOString() ?? null,
  };
}

export function registerHistoryRoutes(app: Hono<AppEnv>): void {
  app.post("/routines/:id/start", requireAuth, async (c) => {
    const { db } = c.var.deps;
    const routine = await findOwnRoutine(db, c.var.user.id, c.req.param("id"));
    if (!routine) {
      return jsonError(c, 404, "Not Found.");
    }
    const now = c.var.deps.now?.() ?? new Date();
    const [history] = await db.insert(histories).values({
      userId: c.var.user.id,
      routineId: routine.id,
      title: routine.title,
      tasks: routine.tasks,
      startedAt: now,
      completed: false,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return c.json({ data: historyResponse(history) }, 201);
  });

  app.get("/histories", requireAuth, async (c) => {
    const rawPage = Number(c.req.query("page") ?? "1");
    const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    // 次ページの存在を判定するため、表示件数より1件だけ多く取得する。
    const rows = await c.var.deps.db.select({
      id: histories.id,
      routineId: histories.routineId,
      title: histories.title,
      startedAt: histories.startedAt,
      finishedAt: histories.finishedAt,
      completed: histories.completed,
    }).from(histories).where(eq(histories.userId, c.var.user.id))
      .orderBy(desc(histories.startedAt)).limit(21).offset((page - 1) * 20);
    const pageUrl = (number: number) => `${c.var.deps.appUrl}/api/histories?page=${number}`;
    return c.json({
      data: rows.slice(0, 20).map((row) => ({
        id: row.id,
        routine_id: row.routineId,
        title: row.title,
        started_at: row.startedAt.toISOString(),
        finished_at: row.finishedAt?.toISOString() ?? null,
        completed: row.completed,
      })),
      meta: {
        next_page_url: rows.length > 20 ? pageUrl(page + 1) : null,
        prev_page_url: page > 1 ? pageUrl(page - 1) : null,
      },
    });
  });

  app.get("/histories/:id", requireAuth, async (c) => {
    const history = await findOwnHistory(c.var.deps.db, c.var.user.id, c.req.param("id"));
    if (!history) {
      return jsonError(c, 404, "Not Found.");
    }
    return c.json({ data: detailResponse(history) });
  });

  for (const [action, completed] of [["complete", true], ["abort", false]] as const) {
    app.post(`/histories/:id/${action}`, requireAuth, async (c) => {
      const { db } = c.var.deps;
      const history = await findOwnHistory(db, c.var.user.id, c.req.param("id"));
      if (!history) {
        return jsonError(c, 404, "Not Found.");
      }
      const now = c.var.deps.now?.() ?? new Date();
      const [saved] = await db.update(histories).set({
        finishedAt: now,
        completed,
        updatedAt: now
      })
        .where(eq(histories.id, history.id)).returning();
      return c.json({ data: historyResponse(saved) });
    });
  }
}
