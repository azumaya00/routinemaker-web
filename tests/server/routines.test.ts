import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { histories, routines } from "@/server/db/schema";
import { createTestContext, loginAs } from "./helpers";

const origin = "https://routinemaker.test";
type Ctx = Awaited<ReturnType<typeof createTestContext>>;

function request(ctx: Ctx, path: string, method: string, cookie: string, body?: unknown) {
  return ctx.app.request(path, {
    method,
    headers: { Cookie: cookie, Origin: origin, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function seed(ctx: Ctx, userId: number, title: string, tasks = ["one"]) {
  const [row] = await ctx.db.insert(routines).values({ userId, title, tasks, createdAt: ctx.now.value, updatedAt: ctx.now.value }).returning();
  return row;
}

test("GET /api/routines は自分のルーティンだけを ID 順に返す", async () => {
  const ctx = await createTestContext();
  const owner = await loginAs(ctx, {});
  const other = await loginAs(ctx, {});
  const first = await seed(ctx, owner.user.id, "first");
  await seed(ctx, other.user.id, "other");
  const last = await seed(ctx, owner.user.id, "last", ["a", "b"]);
  const res = await request(ctx, "/api/routines", "GET", owner.cookie);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ data: [
    { id: first.id, user_id: owner.user.id, title: "first", tasks: ["one"], created_at: "2026-10-23T00:00:00.000Z", updated_at: "2026-10-23T00:00:00.000Z" },
    { id: last.id, user_id: owner.user.id, title: "last", tasks: ["a", "b"], created_at: "2026-10-23T00:00:00.000Z", updated_at: "2026-10-23T00:00:00.000Z" },
  ] });
});

test("POST /api/routines は作成したルーティンを 201 で返す", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, {});
  const res = await request(ctx, "/api/routines", "POST", cookie, { title: "morning", tasks: ["wash", "eat"] });
  expect(res.status).toBe(201);
  expect(await res.json()).toEqual({ data: { id: 1, user_id: user.id, title: "morning", tasks: ["wash", "eat"], created_at: "2026-10-23T00:00:00.000Z", updated_at: "2026-10-23T00:00:00.000Z" } });
  expect(await ctx.db.select().from(routines)).toHaveLength(1);
});

test("free で既に 10 件なら入力チェックより先に件数エラーを返す", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, { plan: "free" });
  for (let i = 0; i < 10; i++) await seed(ctx, user.id, `routine ${i}`);
  const res = await request(ctx, "/api/routines", "POST", cookie, {});
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ message: "無料プランではタスクリストは10件までです。" });
  expect(await ctx.db.select().from(routines)).toHaveLength(10);
});

test.each([
  [{ tasks: ["a"] }, "title", "The title field is required."],
  [{ title: "x", tasks: "wrong" }, "tasks", "The tasks field must be an array."],
  [{ title: "x", tasks: ["x".repeat(256)] }, "tasks.0", "The tasks.0 field must not be greater than 255 characters."],
  [{ title: "x", tasks: [42] }, "tasks.0", "The tasks.0 field must be a string."],
  [{ title: "x", tasks: Array(11).fill("a") }, "tasks", "Tasks must not exceed 10 for this plan."],
])("POST /api/routines は無効な入力を Laravel の形で拒否する: %s", async (body, field, message) => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, { plan: "free" });
  const res = await request(ctx, "/api/routines", "POST", cookie, body);
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ message, errors: { [field]: [message] } });
  expect(await ctx.db.select().from(routines)).toHaveLength(0);
});

test("unlimited は 11 個のタスクを作成できる", async () => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, { plan: "unlimited" });
  const res = await request(ctx, "/api/routines", "POST", cookie, { title: "many", tasks: Array(11).fill("a") });
  expect(res.status).toBe(201);
  expect((await res.json()).data.tasks).toHaveLength(11);
});

test("title と tasks の 255 文字制限は絵文字を 1 文字として数える", async () => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, {});
  const text = "😀".repeat(255);
  const res = await request(ctx, "/api/routines", "POST", cookie, { title: text, tasks: [text] });
  expect(res.status).toBe(201);
  expect((await res.json()).data).toMatchObject({ title: text, tasks: [text] });
});

test("GET と PATCH は自分のルーティンを読み、title と tasks を別々に更新できる", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, {});
  const row = await seed(ctx, user.id, "before");
  const show = await request(ctx, `/api/routines/${row.id}`, "GET", cookie);
  expect(show.status).toBe(200);
  expect((await show.json()).data).toMatchObject({ title: "before", tasks: ["one"] });
  const title = await request(ctx, `/api/routines/${row.id}`, "PATCH", cookie, { title: "after" });
  expect(title.status).toBe(200);
  expect((await title.json()).data).toMatchObject({ title: "after", tasks: ["one"] });
  const tasks = await request(ctx, `/api/routines/${row.id}`, "PATCH", cookie, { tasks: ["two"] });
  expect(tasks.status).toBe(200);
  expect((await tasks.json()).data).toMatchObject({ title: "after", tasks: ["two"] });
});

test("DELETE /api/routines/:id は本人のルーティンと紐づく履歴を消す", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, {});
  const row = await seed(ctx, user.id, "before");
  await ctx.db.insert(histories).values({ userId: user.id, routineId: row.id, title: row.title, tasks: row.tasks, startedAt: ctx.now.value });
  const res = await request(ctx, `/api/routines/${row.id}`, "DELETE", cookie);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ data: { deleted: true } });
  expect(await ctx.db.select().from(routines).where(eq(routines.id, row.id))).toHaveLength(0);
  expect(await ctx.db.select().from(histories)).toHaveLength(0);
});

test.each(["other", "missing", "abc"])("GET・PATCH・DELETE は %s の ID を 404 にする", async (kind) => {
  const ctx = await createTestContext();
  const owner = await loginAs(ctx, {});
  const other = await loginAs(ctx, {});
  const own = await seed(ctx, owner.user.id, "own");
  const foreign = await seed(ctx, other.user.id, "foreign");
  const id = kind === "other" ? String(foreign.id) : kind === "missing" ? "999" : "abc";
  for (const method of ["GET", "PATCH", "DELETE"]) {
    const res = await request(ctx, `/api/routines/${id}`, method, owner.cookie, method === "PATCH" ? { title: "hijack" } : undefined);
    expect(res.status).toBe(404);
  }
  expect((await ctx.db.select().from(routines).where(eq(routines.id, own.id)))[0].title).toBe("own");
  expect((await ctx.db.select().from(routines).where(eq(routines.id, foreign.id)))[0].title).toBe("foreign");
});

test("ルーティン API はログインが必要", async () => {
  const ctx = await createTestContext();
  for (const [method, path] of [["GET", "/api/routines"], ["POST", "/api/routines"], ["GET", "/api/routines/1"], ["PATCH", "/api/routines/1"], ["DELETE", "/api/routines/1"]]) {
    const res = await ctx.app.request(path, { method, headers: { Origin: origin } });
    expect(res.status).toBe(401);
  }
});
