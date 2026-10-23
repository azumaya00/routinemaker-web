import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { userSettings } from "@/server/db/schema";
import { createTestContext, loginAs } from "./helpers";

const origin = "https://routinemaker.test";

test("GET /api/settings は設定がなければ既定値を作って返す", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, {});
  const res = await ctx.app.request("/api/settings", { headers: { Cookie: cookie } });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ data: { id: expect.any(Number), user_id: user.id, theme: "light", dark_mode: "system",
    show_remaining_tasks: false, show_elapsed_time: false, show_celebration: false,
    created_at: "2026-10-23T00:00:00.000Z", updated_at: "2026-10-23T00:00:00.000Z" } });
});

test("GET /api/settings を繰り返しても次のユーザーの設定 ID が飛ばない", async () => {
  const ctx = await createTestContext();
  const first = await loginAs(ctx, {});
  const ids: number[] = [];
  for (let i = 0; i < 3; i++) {
    const res = await ctx.app.request("/api/settings", { headers: { Cookie: first.cookie } });
    expect(res.status).toBe(200);
    ids.push((await res.json()).data.id);
  }
  expect(ids).toEqual([1, 1, 1]);
  const second = await loginAs(ctx, {});
  const res = await ctx.app.request("/api/settings", { headers: { Cookie: second.cookie } });
  expect((await res.json()).data.id).toBe(2);
  expect((await ctx.db.select().from(userSettings).where(eq(userSettings.userId, first.user.id)))).toHaveLength(1);
});

test("PATCH /api/settings は指定された項目だけ更新して返す", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, {});
  const request = (body: object) => ctx.app.request("/api/settings", { method: "PATCH", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const first = await request({ theme: "soft", dark_mode: "on", show_remaining_tasks: true, show_elapsed_time: true, show_celebration: true });
  expect(first.status).toBe(200);
  const data = (await first.json()).data;
  expect(data).toMatchObject({ user_id: user.id, theme: "soft", dark_mode: "on", show_remaining_tasks: true, show_elapsed_time: true, show_celebration: true });
  const second = await request({ theme: "dark" });
  expect((await second.json()).data).toMatchObject({ theme: "dark", dark_mode: "on", show_remaining_tasks: true });
  expect((await ctx.db.select().from(userSettings).where(eq(userSettings.userId, user.id)))[0].theme).toBe("dark");
});

test.each([
  [{ theme: "blue" }, "theme", "The selected theme is invalid."],
  [{ dark_mode: "x" }, "dark_mode", "The selected dark mode is invalid."],
  [{ show_celebration: "yes" }, "show_celebration", "The show celebration field must be true or false."],
  [{ show_remaining_tasks: 2 }, "show_remaining_tasks", "The show remaining tasks field must be true or false."],
  [{ show_elapsed_time: "yes" }, "show_elapsed_time", "The show elapsed time field must be true or false."],
])("PATCH /api/settings は無効な入力を Laravel の文言で拒否する", async (body, field, message) => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, {});
  const res = await ctx.app.request("/api/settings", { method: "PATCH", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ message, errors: { [field]: [message] } });
  expect((await ctx.db.select().from(userSettings).where(eq(userSettings.userId, user.id)))[0]).toMatchObject({ theme: "light", darkMode: "system", showCelebration: false });
});

test.each([true, false, 1, 0, "1", "0"])("PATCH /api/settings は Laravel の boolean 値 %s を受け付ける", async (value) => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, {});
  const res = await ctx.app.request("/api/settings", { method: "PATCH", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ show_celebration: value }) });
  expect(res.status).toBe(200);
  expect((await res.json()).data.show_celebration).toBe(value === true || value === 1 || value === "1");
});

test("設定 API はログインが必要", async () => {
  const ctx = await createTestContext();
  for (const method of ["GET", "PATCH"]) {
    const res = await ctx.app.request("/api/settings", { method, headers: { Origin: origin } });
    expect(res.status).toBe(401);
  }
});
