import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { sessions, users } from "@/server/db/schema";
import { hashPassword } from "@/server/lib/password";
import { validateSession } from "@/server/lib/session";
import { createTestContext, loginAs } from "./helpers";

const origin = "https://routinemaker.test";

function post(app: Awaited<ReturnType<typeof createTestContext>>["app"], path: string, body?: object, cookie?: string) {
  return app.request(path, {
    method: "POST",
    headers: { Origin: origin, ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test("正しいメールとパスワードでログインすると 204 と新しい Cookie を返す", async () => {
  const ctx = await createTestContext();
  await loginAs(ctx, { email: "member@example.test", password: await hashPassword("password123") });
  const res = await post(ctx.app, "/api/login", { email: "member@example.test", password: "password123" });
  expect(res.status).toBe(204);
  expect(res.headers.get("set-cookie")).toMatch(/^rm_session=.+; Max-Age=7200;/);
  expect(await ctx.db.select().from(sessions)).toHaveLength(2);
});

test("メールアドレスの大文字小文字が違ってもログインできる", async () => {
  const ctx = await createTestContext();
  await loginAs(ctx, { email: "Foo@Example.com", password: await hashPassword("password123") });
  const res = await post(ctx.app, "/api/login", { email: "foo@example.com", password: "password123" });
  expect(res.status).toBe(204);
});

test.each([
  { kind: "パスワード違い", password: "other", deletedAt: null, storedPassword: "password123" },
  { kind: "退会済み", password: "password123", deletedAt: new Date("2026-10-01T00:00:00Z"), storedPassword: "password123" },
  { kind: "Google ユーザー", password: "password123", deletedAt: null, storedPassword: null },
])("$kind は同じ認証失敗の応答になる", async ({ password, deletedAt, storedPassword }) => {
  const ctx = await createTestContext();
  await ctx.db.insert(users).values({ name: "Member", email: "member@example.test", password: storedPassword && await hashPassword(storedPassword), deletedAt });
  const res = await post(ctx.app, "/api/login", { email: "member@example.test", password });
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ message: "メールアドレスまたはパスワードが正しくありません。" });
  expect(await ctx.db.select().from(sessions)).toHaveLength(0);
});

test("ログイン済みなら入力を検証せず新しいセッションも作らない", async () => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, {});
  const res = await post(ctx.app, "/api/login", {}, cookie);
  expect(res.status).toBe(204);
  expect(await ctx.db.select().from(sessions)).toHaveLength(1);
});

test("ログインで email がなければ Laravel 形式の 422", async () => {
  const ctx = await createTestContext();
  const res = await post(ctx.app, "/api/login", { password: "password123" });
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ message: "The email field is required.", errors: { email: ["The email field is required."] } });
});

test("登録成功で仮の名前・free プラン・非管理者を保存してログイン状態にする", async () => {
  const ctx = await createTestContext();
  const res = await post(ctx.app, "/api/register", { email: "Foo@Example.com", password: "password123", password_confirmation: "password123", is_admin: true });
  expect(res.status).toBe(204);
  const [user] = await ctx.db.select().from(users);
  expect(user).toMatchObject({ name: "Foo", email: "Foo@Example.com", plan: "free", isAdmin: false });
  const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
  expect(cookie).toMatch(/^rm_session=.+/);
  expect((await validateSession(ctx.db, cookie.split("=")[1], ctx.now.value))?.user.id).toBe(user.id);
});

test("登録済みメールは大文字小文字を問わず拒否する", async () => {
  const ctx = await createTestContext();
  await loginAs(ctx, { email: "Foo@Example.com" });
  const res = await post(ctx.app, "/api/register", { email: "foo@example.com", password: "password123", password_confirmation: "password123" });
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ message: "このメールアドレスは既に登録されています。" });
});

test("退会済みメールは復元案内を返す", async () => {
  const ctx = await createTestContext();
  await ctx.db.insert(users).values({ name: "Former", email: "Foo@Example.com", deletedAt: ctx.now.value });
  const res = await post(ctx.app, "/api/register", { email: "foo@example.com", password: "password123", password_confirmation: "password123" });
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ message: "このメールアドレスは退会済みです。パスワード再設定から復元してください。" });
});

test("登録のパスワード違反を Laravel の順番と文言で返す", async () => {
  const ctx = await createTestContext();
  const res = await post(ctx.app, "/api/register", { email: "new@example.test", password: "abc", password_confirmation: "abc" });
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({
    message: "パスワードは8文字以上である必要があります。 (and 1 more error)",
    errors: { password: ["パスワードは8文字以上である必要があります。", "パスワードには数字が含まれている必要があります。"] },
  });
});

test("登録の確認用パスワードが違えば一致エラーを返す", async () => {
  const ctx = await createTestContext();
  const res = await post(ctx.app, "/api/register", { email: "new@example.test", password: "password123", password_confirmation: "password124" });
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ message: "パスワードが一致しません。", errors: { password: ["パスワードが一致しません。"] } });
});

test.each([
  [{ password: "password123", password_confirmation: "password123" }, "メールアドレスは必須です。"],
  [{ email: "invalid", password: "password123", password_confirmation: "password123" }, "有効なメールアドレスを入力してください。"],
])("登録のメール検証文言が Laravel と一致する", async (body, message) => {
  const ctx = await createTestContext();
  const res = await post(ctx.app, "/api/register", body);
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ message, errors: { email: [message] } });
});

test("ログアウトはセッションと Cookie を削除する", async () => {
  const ctx = await createTestContext();
  const { cookie, user } = await loginAs(ctx, {});
  const res = await post(ctx.app, "/api/logout", undefined, cookie);
  expect(res.status).toBe(204);
  expect(res.headers.get("set-cookie")).toMatch(/rm_session=;.*Max-Age=0/);
  expect(await ctx.db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
});

test("残り60分未満でログアウトしても削除 Cookie だけを返す", async () => {
  const ctx = await createTestContext();
  const { cookie } = await loginAs(ctx, {});
  ctx.now.value = new Date("2026-10-23T01:00:01.000Z");
  const res = await post(ctx.app, "/api/logout", undefined, cookie);
  expect(res.status).toBe(204);
  expect(res.headers.getSetCookie()).toHaveLength(1);
  expect(res.headers.getSetCookie()[0]).toMatch(/rm_session=;.*Max-Age=0/);
});

test("未ログインのログアウトは 401", async () => {
  const ctx = await createTestContext();
  const res = await post(ctx.app, "/api/logout");
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ message: "Unauthenticated." });
});
