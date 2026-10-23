import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { expect, test } from "vitest";
import { sessions, users } from "@/server/db/schema";
import {
  createSession,
  deleteSession,
  deleteUserSessions,
  clearSessionCookie,
  setSessionCookie,
  validateSession,
} from "@/server/lib/session";
import { createTestContext, loginAs } from "./helpers";

test("作成直後のセッションからユーザーを取得できる", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, {});
  const token = cookie.split(";")[0].split("=")[1];
  expect(await validateSession(ctx.db, token, ctx.now.value)).toEqual({ user, extended: false });
});

test("最後のアクセスから120分を過ぎたセッションは無効", async () => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, {});
  ctx.now.value = new Date("2026-10-23T02:00:01.000Z");
  expect(await validateSession(ctx.db, cookie.split(";")[0].split("=")[1], ctx.now.value)).toBeNull();
});

test("残り60分未満なら有効期限を現在から120分に延ばす", async () => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, {});
  const token = cookie.split(";")[0].split("=")[1];
  ctx.now.value = new Date("2026-10-23T01:00:01.000Z");
  expect((await validateSession(ctx.db, token, ctx.now.value))?.extended).toBe(true);
  const [row] = await ctx.db.select().from(sessions);
  expect(row.expiresAt.toISOString()).toBe("2026-10-23T03:00:01.000Z");
});

test("残り60分以上なら有効期限を書き換えない", async () => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, {});
  ctx.now.value = new Date("2026-10-23T01:00:00.000Z");
  expect((await validateSession(ctx.db, cookie.split(";")[0].split("=")[1], ctx.now.value))?.extended).toBe(false);
  const [row] = await ctx.db.select().from(sessions);
  expect(row.expiresAt.toISOString()).toBe("2026-10-23T02:00:00.000Z");
});

test("退会済みユーザーのセッションは無効", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, {});
  await ctx.db.update(users).set({ deletedAt: ctx.now.value }).where(eq(users.id, user.id));
  expect(await validateSession(ctx.db, cookie.split(";")[0].split("=")[1], ctx.now.value)).toBeNull();
});

test("DB には Cookie の生の値を保存しない", async () => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, {});
  const [row] = await ctx.db.select().from(sessions);
  expect(row.id).toMatch(/^[a-f0-9]{64}$/);
  expect(row.id).not.toBe(cookie.split(";")[0].split("=")[1]);
});

test("セッションを1件またはユーザー単位で削除できる", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, {});
  const token = cookie.split(";")[0].split("=")[1];
  const second = await createSession(ctx.db, user.id, ctx.now.value);
  await deleteSession(ctx.db, token);
  expect(await validateSession(ctx.db, token, ctx.now.value)).toBeNull();
  expect(await validateSession(ctx.db, second, ctx.now.value)).not.toBeNull();
  await deleteUserSessions(ctx.db, user.id);
  expect(await validateSession(ctx.db, second, ctx.now.value)).toBeNull();
});

test("セッション Cookie は安全な属性を持ち、削除時に期限を切る", async () => {
  const app = new Hono();
  app.get("/set", (c) => { setSessionCookie(c, "token"); return c.body(null, 204); });
  app.get("/clear", (c) => { clearSessionCookie(c); return c.body(null, 204); });
  const set = (await app.request("/set")).headers.get("set-cookie") ?? "";
  expect(set).toContain("rm_session=token");
  expect(set).toMatch(/HttpOnly/i);
  expect(set).toMatch(/Secure/i);
  expect(set).toMatch(/SameSite=Lax/i);
  expect(set).toContain("Path=/");
  expect(set).toContain("Max-Age=7200");
  const clear = (await app.request("/clear")).headers.get("set-cookie") ?? "";
  expect(clear).toContain("rm_session=");
  expect(clear).toMatch(/Max-Age=0/i);
});
