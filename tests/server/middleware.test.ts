import { Hono } from "hono";
import { expect, test } from "vitest";
import { requireAuth } from "@/server/middleware/auth";
import { requireAdmin } from "@/server/middleware/admin";
import { csrf } from "@/server/middleware/csrf";
import { rateLimit } from "@/server/middleware/rateLimit";
import type { AppEnv } from "@/server/types";
import { createTestContext, loginAs } from "./helpers";
import { eq } from "drizzle-orm";
import { users } from "@/server/db/schema";

test("Cookie がなければ認証は 401 を返す", async () => {
  const ctx = await createTestContext();
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => { c.set("deps", ctx.deps); await next(); });
  app.get("/private", requireAuth, (c) => c.json({ id: c.var.user.id, token: c.var.sessionToken }));
  const res = await app.request("/private");
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ message: "Unauthenticated." });
});

test("期限切れと退会済みの Cookie は 401 を返す", async () => {
  const ctx = await createTestContext();
  const { cookie, user } = await loginAs(ctx, {});
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => { c.set("deps", ctx.deps); await next(); });
  app.get("/private", requireAuth, (c) => c.json({ id: c.var.user.id }));
  ctx.now.value = new Date("2026-10-23T02:00:01.000Z");
  const res = await app.request("/private", { headers: { Cookie: cookie } });
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ message: "Unauthenticated." });
  ctx.now.value = new Date("2026-10-23T00:00:00.000Z");
  await ctx.db.update(users).set({ deletedAt: ctx.now.value }).where(eq(users.id, user.id));
  const deleted = await app.request("/private", { headers: { Cookie: cookie } });
  expect(deleted.status).toBe(401);
  expect(await deleted.json()).toEqual({ message: "Unauthenticated." });
});

test("残り60分未満で保護されたルートにアクセスすると rm_session Cookie を120分に更新する", async () => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, {});
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => { c.set("deps", ctx.deps); await next(); });
  app.get("/private", requireAuth, (c) => c.json({ ok: true }));
  ctx.now.value = new Date("2026-10-23T01:00:01.000Z");

  const res = await app.request("/private", { headers: { Cookie: cookie } });

  expect(res.status).toBe(200);
  expect(res.headers.get("set-cookie")).toContain(`${cookie};`);
  expect(res.headers.get("set-cookie")).toContain("Max-Age=7200");
});

test("残り60分以上で保護されたルートにアクセスしても Set-Cookie は付かない", async () => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, {});
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => { c.set("deps", ctx.deps); await next(); });
  app.get("/private", requireAuth, (c) => c.json({ ok: true }));
  ctx.now.value = new Date("2026-10-23T01:00:00.000Z");

  const res = await app.request("/private", { headers: { Cookie: cookie } });

  expect(res.status).toBe(200);
  expect(res.headers.has("set-cookie")).toBe(false);
});

test("一般ユーザーは管理者用の操作を実行できない", async () => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, { isAdmin: false });
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => { c.set("deps", ctx.deps); await next(); });
  app.get("/admin", requireAuth, requireAdmin, (c) => c.json({ ok: true }));
  const res = await app.request("/admin", { headers: { Cookie: cookie } });
  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({ message: "管理者権限が必要です。" });
});

test("管理者には認証ユーザーと生のセッショントークンを渡す", async () => {
  const ctx = await createTestContext();
  const { cookie, user } = await loginAs(ctx, { isAdmin: true });
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => { c.set("deps", ctx.deps); await next(); });
  app.get("/admin", requireAuth, requireAdmin, (c) => c.json({ id: c.var.user.id, token: c.var.sessionToken }));
  const res = await app.request("/admin", { headers: { Cookie: cookie } });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ id: user.id, token: cookie.split(";")[0].split("=")[1] });
});

test("POST は同一 Origin のみ通し、拒否時は処理を実行しない", async () => {
  const ctx = await createTestContext();
  let writes = 0;
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => { c.set("deps", ctx.deps); await next(); });
  app.post("/write", csrf, (c) => { writes++; return c.json({ ok: true }); });
  for (const origin of [undefined, "https://other.test"]) {
    const res = await app.request("/write", { method: "POST", headers: origin ? { Origin: origin } : {} });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ message: "Forbidden." });
  }
  expect(writes).toBe(0);
  const res = await app.request("/write", { method: "POST", headers: { Origin: "https://routinemaker.test" } });
  expect(res.status).toBe(200);
  expect(writes).toBe(1);
});

test("GET・HEAD・OPTIONS は Origin がなくても通る", async () => {
  const ctx = await createTestContext();
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => { c.set("deps", ctx.deps); await next(); });
  app.use("*", csrf);
  app.get("/read", (c) => c.json({ ok: true }));
  app.on(["HEAD", "OPTIONS"], "/read", (c) => c.body(null, 204));
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    expect((await app.request("/read", { method })).status).toBeLessThan(300);
  }
});

test("同じ IP の11回目は 429、1分後は再び通る", async () => {
  const ctx = await createTestContext();
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => { c.set("deps", ctx.deps); await next(); });
  app.post("/login", rateLimit("login", 10), (c) => c.json({ ok: true }));
  for (let i = 0; i < 10; i++) {
    expect((await app.request("/login", { method: "POST", headers: { "x-real-ip": "192.0.2.1" } })).status).toBe(200);
  }
  const limited = await app.request("/login", { method: "POST", headers: { "x-real-ip": "192.0.2.1" } });
  expect(limited.status).toBe(429);
  expect(await limited.json()).toEqual({ message: "Too Many Attempts." });
  ctx.now.value = new Date("2026-10-23T00:01:01.000Z");
  expect((await app.request("/login", { method: "POST", headers: { "x-real-ip": "192.0.2.1" } })).status).toBe(200);
});

test("x-forwarded-for の先頭 IP を使い、別 IP は別に数える", async () => {
  const ctx = await createTestContext();
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => { c.set("deps", ctx.deps); await next(); });
  app.post("/login", rateLimit("login", 1), (c) => c.json({ ok: true }));
  const request = (ip: string) => app.request("/login", { method: "POST", headers: { "x-forwarded-for": `${ip}, 203.0.113.1`, "x-real-ip": "203.0.113.2" } });
  expect((await request("192.0.2.1")).status).toBe(200);
  expect((await request("192.0.2.1")).status).toBe(429);
  expect((await request("192.0.2.2")).status).toBe(200);
});
