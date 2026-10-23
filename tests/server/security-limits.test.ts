import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { users } from "@/server/db/schema";
import { hashPassword } from "@/server/lib/password";
import { createTestContext, loginAs } from "./helpers";

const origin = "https://routinemaker.test";

function post(ctx: Awaited<ReturnType<typeof createTestContext>>, path: string, body: object, cookie?: string) {
  return ctx.app.request(path, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
}

test("/api 全体で 64KB を超える本文は 413", async () => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, {});
  const emptyBodyBytes = Buffer.byteLength(JSON.stringify({ title: "x", tasks: ["x"], padding: "" }));
  const padding = "a".repeat(64 * 1024 - emptyBodyBytes);
  const within = await post(ctx, "/api/routines", { title: "x", tasks: ["x"], padding }, cookie);
  expect(within.status).toBe(201);
  const over = await post(ctx, "/api/routines", { title: "x", tasks: ["x"], padding: padding + "a" }, cookie);
  expect(over.status).toBe(413);
  expect(await over.json()).toEqual({ message: "Payload Too Large." });
});

test.each(["/api/register", "/api/reset-password", "/api/login"]) ("%s のパスワードは72バイトまで", async (path) => {
  const ctx = await createTestContext();
  const body = { email: "member@example.test", token: "abc", password_confirmation: "aA1" + "x".repeat(69), password: "aA1" + "x".repeat(69) };
  const within = await post(ctx, path, body);
  expect((await within.json().catch(() => ({}))).errors?.password).toBeUndefined();
  const overPassword = "aA1" + "x".repeat(70);
  const over = await post(ctx, path, { ...body, password: overPassword, password_confirmation: overPassword });
  expect(over.status).toBe(422);
  expect(await over.json()).toMatchObject({ errors: { password: ["The password field must not be greater than 72 characters."] } });
});

test("退会パスワードは UTF-8 で72バイトまで", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, { password: await hashPassword("aA1" + "あ".repeat(23)) });
  const request = (password: string) => ctx.app.request("/api/me", { method: "DELETE", headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  const over = await request("aA1" + "あ".repeat(24));
  expect(over.status).toBe(422);
  expect(await over.json()).toMatchObject({ errors: { password: ["The password field must not be greater than 72 characters."] } });
  expect((await ctx.db.select().from(users).where(eq(users.id, user.id)))[0].deletedAt).toBeNull();
  expect((await request("aA1" + "あ".repeat(23))).status).toBe(204);
});

test.each(["/api/login", "/api/register", "/api/forgot-password", "/api/reset-password"]) ("%s のメールは255文字まで", async (path) => {
  const ctx = await createTestContext();
  const email = `${"a".repeat(63)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(58)}.test`;
  const body = { email, token: "abc", password: "password123", password_confirmation: "password123" };
  const within = await post(ctx, path, body);
  expect((await within.json().catch(() => ({}))).errors?.email).toBeUndefined();
  const over = await post(ctx, path, { ...body, email: email.replace(`${"d".repeat(58)}.test`, `${"d".repeat(59)}.test`) });
  expect(over.status).toBe(422);
  expect(await over.json()).toMatchObject({ errors: { email: ["The email field must not be greater than 255 characters."] } });
});

test("再設定トークンは255文字まで", async () => {
  const ctx = await createTestContext();
  const body = { email: "member@example.test", token: "a".repeat(255), password: "password123", password_confirmation: "password123" };
  const within = await post(ctx, "/api/reset-password", body);
  expect((await within.json()).errors?.token).toBeUndefined();
  const over = await post(ctx, "/api/reset-password", { ...body, token: "a".repeat(256) });
  expect(over.status).toBe(422);
  expect(await over.json()).toMatchObject({ errors: { token: ["The token field must not be greater than 255 characters."] } });
});

test("unlimited の tasks は100個まで", async () => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, { plan: "unlimited" });
  expect((await post(ctx, "/api/routines", { title: "hundred", tasks: Array(100).fill("x") }, cookie)).status).toBe(201);
  const over = await post(ctx, "/api/routines", { title: "too many", tasks: Array(101).fill("x") }, cookie);
  expect(over.status).toBe(422);
  expect(await over.json()).toMatchObject({ errors: { tasks: ["The tasks field must not have more than 100 items."] } });
});
