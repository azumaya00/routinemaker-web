import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { histories, routines } from "@/server/db/schema";
import { createTestContext, loginAs } from "./helpers";

const origin = "https://routinemaker.test";
type Ctx = Awaited<ReturnType<typeof createTestContext>>;

function request(ctx: Ctx, path: string, method: string, cookie: string) {
  return ctx.app.request(path, { method, headers: { Cookie: cookie, Origin: origin } });
}

async function seedRoutine(ctx: Ctx, userId: number, title = "morning", tasks = ["wash", "eat"]) {
  const [row] = await ctx.db.insert(routines).values({ userId, title, tasks, createdAt: ctx.now.value, updatedAt: ctx.now.value }).returning();
  return row;
}

async function seedHistory(ctx: Ctx, userId: number, routineId: number, startedAt: Date, title = "morning") {
  const [row] = await ctx.db.insert(histories).values({ userId, routineId, title, tasks: ["wash"], startedAt, createdAt: startedAt, updatedAt: startedAt }).returning();
  return row;
}

test("start はルーティンのスナップショットを 201 で返し、編集後も変わらない", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, {});
  const routine = await seedRoutine(ctx, user.id);
  const res = await request(ctx, `/api/routines/${routine.id}/start`, "POST", cookie);
  expect(res.status).toBe(201);
  expect(await res.json()).toEqual({ data: {
    id: 1, user_id: user.id, routine_id: routine.id, title: "morning", tasks: ["wash", "eat"],
    started_at: "2026-10-23T00:00:00.000Z", finished_at: null, completed: false,
    created_at: "2026-10-23T00:00:00.000Z", updated_at: "2026-10-23T00:00:00.000Z",
  } });
  await ctx.db.update(routines).set({ title: "changed", tasks: ["changed"] }).where(eq(routines.id, routine.id));
  const [saved] = await ctx.db.select().from(histories);
  expect(saved).toMatchObject({ title: "morning", tasks: ["wash", "eat"] });
});

test.each([["complete", true], ["abort", false]] as const)("%s は終了時刻と completed を保存する", async (action, completed) => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, {});
  const routine = await seedRoutine(ctx, user.id);
  const history = await seedHistory(ctx, user.id, routine.id, new Date("2026-10-22T00:00:00.000Z"));
  const res = await request(ctx, `/api/histories/${history.id}/${action}`, "POST", cookie);
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ data: { id: history.id, finished_at: "2026-10-23T00:00:00.000Z", completed } });
  const [saved] = await ctx.db.select().from(histories).where(eq(histories.id, history.id));
  expect(saved.finishedAt?.toISOString()).toBe("2026-10-23T00:00:00.000Z");
  expect(saved.completed).toBe(completed);
});

test("一覧は自分の履歴を開始日時の新しい順に軽量な項目だけで返す", async () => {
  const ctx = await createTestContext();
  const owner = await loginAs(ctx, {});
  const other = await loginAs(ctx, {});
  const ownRoutine = await seedRoutine(ctx, owner.user.id);
  const otherRoutine = await seedRoutine(ctx, other.user.id);
  const older = await seedHistory(ctx, owner.user.id, ownRoutine.id, new Date("2026-10-20T00:00:00.000Z"), "older");
  const newer = await seedHistory(ctx, owner.user.id, ownRoutine.id, new Date("2026-10-22T00:00:00.000Z"), "newer");
  await seedHistory(ctx, other.user.id, otherRoutine.id, new Date("2026-10-23T00:00:00.000Z"), "foreign");
  const res = await request(ctx, "/api/histories", "GET", owner.cookie);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ data: [
    { id: newer.id, routine_id: ownRoutine.id, title: "newer", started_at: "2026-10-22T00:00:00.000Z", finished_at: null, completed: false },
    { id: older.id, routine_id: ownRoutine.id, title: "older", started_at: "2026-10-20T00:00:00.000Z", finished_at: null, completed: false },
  ], meta: { next_page_url: null, prev_page_url: null } });
});

test("25 件の一覧は 20 件ずつページ送りし、per_page=100 を無視する", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, {});
  const routine = await seedRoutine(ctx, user.id);
  for (let day = 1; day <= 25; day++) {
    await seedHistory(ctx, user.id, routine.id, new Date(Date.UTC(2026, 8, day)), `day ${day}`);
  }
  const first = await request(ctx, "/api/histories?per_page=100", "GET", cookie);
  expect(first.status).toBe(200);
  const firstBody = await first.json();
  expect(firstBody.data).toHaveLength(20);
  expect(firstBody.data.map((item: { title: string }) => item.title)).toEqual(Array.from({ length: 20 }, (_, i) => `day ${25 - i}`));
  expect(firstBody.meta).toEqual({ next_page_url: "https://routinemaker.test/api/histories?page=2", prev_page_url: null });
  const second = await request(ctx, "/api/histories?page=2", "GET", cookie);
  expect(second.status).toBe(200);
  const secondBody = await second.json();
  expect(secondBody.data.map((item: { title: string }) => item.title)).toEqual(["day 5", "day 4", "day 3", "day 2", "day 1"]);
  expect(secondBody.meta).toEqual({ next_page_url: null, prev_page_url: "https://routinemaker.test/api/histories?page=1" });
});

test("詳細は tasks と作成・更新日時を含める", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, {});
  const routine = await seedRoutine(ctx, user.id);
  const history = await seedHistory(ctx, user.id, routine.id, ctx.now.value);
  const res = await request(ctx, `/api/histories/${history.id}`, "GET", cookie);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ data: {
    id: history.id, routine_id: routine.id, title: "morning", tasks: ["wash"],
    started_at: "2026-10-23T00:00:00.000Z", finished_at: null, completed: false,
    created_at: "2026-10-23T00:00:00.000Z", updated_at: "2026-10-23T00:00:00.000Z",
  } });
});

test.each(["foreign", "missing", "abc"])("%s の履歴は詳細・完了・中断とも 404", async (kind) => {
  const ctx = await createTestContext();
  const owner = await loginAs(ctx, {});
  const other = await loginAs(ctx, {});
  const routine = await seedRoutine(ctx, other.user.id);
  const foreign = await seedHistory(ctx, other.user.id, routine.id, ctx.now.value);
  const id = kind === "foreign" ? String(foreign.id) : kind === "missing" ? "999" : "abc";
  for (const [method, suffix] of [["GET", ""], ["POST", "/complete"], ["POST", "/abort"]]) {
    const res = await request(ctx, `/api/histories/${id}${suffix}`, method, owner.cookie);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Not Found." });
  }
  const [saved] = await ctx.db.select().from(histories).where(eq(histories.id, foreign.id));
  expect(saved.finishedAt).toBeNull();
});

test.each(["foreign", "missing", "abc"])("%s のルーティンは開始できない", async (kind) => {
  const ctx = await createTestContext();
  const owner = await loginAs(ctx, {});
  const other = await loginAs(ctx, {});
  const routine = await seedRoutine(ctx, other.user.id);
  const id = kind === "foreign" ? String(routine.id) : kind === "missing" ? "999" : "abc";
  const res = await request(ctx, `/api/routines/${id}/start`, "POST", owner.cookie);
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ message: "Not Found." });
  expect(await ctx.db.select().from(histories)).toHaveLength(0);
});

test("履歴 API はログインが必要", async () => {
  const ctx = await createTestContext();
  for (const [method, path] of [["POST", "/api/routines/1/start"], ["GET", "/api/histories"], ["GET", "/api/histories/1"], ["POST", "/api/histories/1/complete"], ["POST", "/api/histories/1/abort"]]) {
    const res = await ctx.app.request(path, { method, headers: { Origin: origin } });
    expect(res.status).toBe(401);
  }
});
