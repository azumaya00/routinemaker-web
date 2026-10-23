import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { sessions, userSettings, users } from "@/server/db/schema";
import { hashPassword } from "@/server/lib/password";
import { createSession } from "@/server/lib/session";
import { createTestContext, loginAs } from "./helpers";

const origin = "https://routinemaker.test";

test("GET /api/me は Laravel の形でユーザーと既定の設定を返し保存する", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, { name: "Test", email: "Foo@Example.com", password: "hash", provider: null });
  const res = await ctx.app.request("/api/me", { headers: { Cookie: cookie } });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toEqual({ data: {
    user: { id: user.id, name: "Test", email: "Foo@Example.com", plan: "free", is_admin: false,
      has_password: true, provider: null, tutorial_dismissed_at: null, tutorial_should_show: true },
    plan: "free",
    settings: { id: expect.any(Number), user_id: user.id, theme: "light", dark_mode: "system",
      show_remaining_tasks: false, show_elapsed_time: false, show_celebration: false,
      created_at: "2026-10-23T00:00:00.000Z", updated_at: "2026-10-23T00:00:00.000Z" },
  } });
  const second = await ctx.app.request("/api/me", { headers: { Cookie: cookie } });
  expect((await second.json()).data.settings.id).toBe(body.data.settings.id);
  expect(await ctx.db.select().from(userSettings)).toHaveLength(1);
});

test("GET /api/me は非表示済みならチュートリアルを表示しない", async () => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, { tutorialDismissedAt: new Date("2026-10-20T01:02:03.000Z") });
  const res = await ctx.app.request("/api/me", { headers: { Cookie: cookie } });
  expect((await res.json()).data.user).toMatchObject({ tutorial_dismissed_at: "2026-10-20T01:02:03.000Z", tutorial_should_show: false });
});

test("POST /api/tutorial/dismiss は初回の日時を保存し、再実行でも変更しない", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, { updatedAt: new Date("2026-10-20T00:00:00.000Z") });
  const request = () => ctx.app.request("/api/tutorial/dismiss", { method: "POST", headers: { Cookie: cookie, Origin: origin } });
  const first = await request();
  expect(first.status).toBe(200);
  expect(await first.json()).toEqual({ data: { tutorial_dismissed_at: "2026-10-23T00:00:00.000Z", tutorial_should_show: false } });
  ctx.now.value = new Date("2026-10-23T01:00:00.000Z");
  const second = await request();
  expect(await second.json()).toEqual({ data: { tutorial_dismissed_at: "2026-10-23T00:00:00.000Z", tutorial_should_show: false } });
  expect((await ctx.db.select().from(users).where(eq(users.id, user.id)))[0].tutorialDismissedAt?.toISOString()).toBe("2026-10-23T00:00:00.000Z");
  expect((await ctx.db.select().from(users).where(eq(users.id, user.id)))[0].updatedAt?.toISOString()).toBe("2026-10-23T00:00:00.000Z");
});

test("DELETE /api/me は正しいパスワードで論理削除してセッションと Cookie を消す", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, { password: await hashPassword("secret123"), updatedAt: new Date("2026-10-20T00:00:00.000Z") });
  const res = await ctx.app.request("/api/me", { method: "DELETE", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ password: "secret123" }) });
  expect(res.status).toBe(204);
  expect(res.headers.get("set-cookie")).toMatch(/rm_session=;.*Max-Age=0/);
  expect((await ctx.db.select().from(users).where(eq(users.id, user.id)))[0].deletedAt?.toISOString()).toBe("2026-10-23T00:00:00.000Z");
  expect((await ctx.db.select().from(users).where(eq(users.id, user.id)))[0].updatedAt?.toISOString()).toBe("2026-10-23T00:00:00.000Z");
  expect(await ctx.db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
  expect((await ctx.app.request("/api/me", { headers: { Cookie: cookie } })).status).toBe(401);
});

test("端末 A の退会で端末 B のセッションも削除する", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, { password: await hashPassword("secret123") });
  const otherCookie = `rm_session=${await createSession(ctx.db, user.id, ctx.now.value)}`;
  const res = await ctx.app.request("/api/me", { method: "DELETE", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ password: "secret123" }) });
  expect(res.status).toBe(204);
  expect(await ctx.db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
  expect((await ctx.app.request("/api/me", { headers: { Cookie: otherCookie } })).status).toBe(401);
});

test("残り60分未満で退会しても削除 Cookie だけを返す", async () => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, { password: await hashPassword("secret123") });
  ctx.now.value = new Date("2026-10-23T01:00:01.000Z");
  const res = await ctx.app.request("/api/me", { method: "DELETE", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ password: "secret123" }) });
  expect(res.status).toBe(204);
  expect(res.headers.getSetCookie()).toHaveLength(1);
  expect(res.headers.getSetCookie()[0]).toMatch(/rm_session=;.*Max-Age=0/);
});

test.each([
  [{ password: "wrong" }, "パスワードが一致しません。"],
  [{}, "パスワードは必須です。"],
  [{ password: 123 }, "The password field must be a string."],
])("DELETE /api/me のパスワード違反は 422 で退会させない", async (body, message) => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, { password: await hashPassword("secret123") });
  const res = await ctx.app.request("/api/me", { method: "DELETE", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ message, errors: { password: [message] } });
  expect((await ctx.db.select().from(users).where(eq(users.id, user.id)))[0].deletedAt).toBeNull();
});

test("DELETE /api/me は Google ユーザーならパスワードなしで退会できる", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, { password: null, provider: "google" });
  const res = await ctx.app.request("/api/me", { method: "DELETE", headers: { Cookie: cookie, Origin: origin } });
  expect(res.status).toBe(204);
  expect((await ctx.db.select().from(users).where(eq(users.id, user.id)))[0].deletedAt).not.toBeNull();
});

test("DELETE /api/me は Google ユーザーの文字列以外のパスワードを拒否する", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, { password: null, provider: "google" });
  const res = await ctx.app.request("/api/me", { method: "DELETE", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ password: 123 }) });
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ message: "The password field must be a string.", errors: { password: ["The password field must be a string."] } });
  expect((await ctx.db.select().from(users).where(eq(users.id, user.id)))[0].deletedAt).toBeNull();
});

test("自分の情報とチュートリアルはログインが必要", async () => {
  const ctx = await createTestContext();
  for (const [path, method] of [["/api/me", "GET"], ["/api/me", "DELETE"], ["/api/tutorial/dismiss", "POST"]]) {
    const res = await ctx.app.request(path, { method, headers: { Origin: origin } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: "Unauthenticated." });
  }
});
