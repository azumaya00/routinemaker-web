import { expect, test } from "vitest";
import { createTestContext, loginAs } from "./helpers";

test("GET /api/admin/ping は管理者の情報を返す", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, { isAdmin: true, email: "Admin@Example.com" });
  const res = await ctx.app.request("/api/admin/ping", { headers: { Cookie: cookie } });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ message: "Admin access granted", user: { id: user.id, email: "Admin@Example.com", is_admin: true } });
});

test("GET /api/admin/ping は一般ユーザーを 403 で拒否する", async () => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, { isAdmin: false });
  const res = await ctx.app.request("/api/admin/ping", { headers: { Cookie: cookie } });
  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({ message: "管理者権限が必要です。" });
});

test("GET /api/admin/ping は未ログインを 401 で拒否する", async () => {
  const ctx = await createTestContext();
  const res = await ctx.app.request("/api/admin/ping");
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ message: "Unauthenticated." });
});
