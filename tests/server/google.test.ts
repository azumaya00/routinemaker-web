import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { sessions, users } from "@/server/db/schema";
import { validateSession } from "@/server/lib/session";
import { createTestContext, loginAs } from "./helpers";

type Ctx = Awaited<ReturnType<typeof createTestContext>>;
const failed = { message: "Google認証に失敗しました。もう一度お試しください。" };

async function begin(ctx: Ctx) {
  const res = await ctx.app.request("/api/auth/google/redirect");
  const url = new URL(res.headers.get("location")!);
  const cookies = res.headers.getSetCookie();
  const cookie = cookies.map((value) => value.split(";")[0]).join("; ");
  return { res, url, cookies, cookie, state: url.searchParams.get("state")! };
}

function callback(ctx: Ctx, state: string, cookie: string, headers: Record<string, string> = {}) {
  return ctx.app.request(`/api/auth/google/callback?code=auth-code&state=${encodeURIComponent(state)}`, {
    headers: { Cookie: cookie, ...headers },
  });
}

test("redirect は 302 と state・verifier の安全な10分 Cookie を返す", async () => {
  const ctx = await createTestContext();
  const { res, url, cookies } = await begin(ctx);
  expect(res.status).toBe(302);
  expect(url.origin).toBe("https://accounts.google.test");
  expect(url.searchParams.get("state")).toMatch(/^[\w-]{43}$/);
  expect(url.searchParams.get("code_challenge")).toMatch(/^[\w-]{43}$/);
  expect(cookies).toHaveLength(2);
  for (const value of cookies) {
    expect(value).toMatch(/^rm_google_(state|verifier)=[\w-]{43};/);
    expect(value).toContain("Max-Age=600");
    expect(value).toContain("Path=/api/auth/google");
    expect(value).toContain("HttpOnly");
    expect(value).toContain("Secure");
    expect(value).toContain("SameSite=Lax");
  }
});

test.each(["wrong-state", "missing-cookies", "missing-code"])("callback の %s は認証失敗を返しユーザーを作らない", async (kind) => {
  const ctx = await createTestContext();
  const { cookie, state } = await begin(ctx);
  const res = kind === "missing-code"
    ? await ctx.app.request(`/api/auth/google/callback?state=${state}`, { headers: { Cookie: cookie } })
    : await callback(ctx, kind === "wrong-state" ? "wrong" : state, kind === "missing-cookies" ? "" : cookie);
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual(failed);
  expect(await ctx.db.select().from(users)).toHaveLength(0);
});

test("Google のプロフィール取得失敗は 400 を返す", async () => {
  const ctx = await createTestContext();
  ctx.google.nextError = new Error("invalid token");
  const { cookie, state } = await begin(ctx);
  const res = await callback(ctx, state, cookie);
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual(failed);
});

test("Google にメールがなければ 422 を返す", async () => {
  const ctx = await createTestContext();
  ctx.google.nextProfile.email = null;
  const { cookie, state } = await begin(ctx);
  const res = await callback(ctx, state, cookie);
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ message: "Googleアカウントにメールアドレスがありません。別のアカウントをお試しください。" });
});

test("A: provider_id が一致するユーザーを更新し、plan を保ってログインする", async () => {
  const ctx = await createTestContext();
  const { user } = await loginAs(ctx, { email: "old@example.test", name: "Old", provider: "google", providerId: "google-test-id", plan: "unlimited" });
  ctx.google.nextProfile = { sub: "google-test-id", email: "New@Example.com", name: "New" };
  const { cookie, state } = await begin(ctx);
  const res = await callback(ctx, state, cookie);
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("https://routinemaker.test/routines");
  const [updated] = await ctx.db.select().from(users).where(eq(users.id, user.id));
  expect(updated).toMatchObject({ email: "New@Example.com", name: "New", plan: "unlimited", providerId: "google-test-id" });
  expect(await ctx.db.select().from(users)).toHaveLength(1);
  const sessionCookie = res.headers.getSetCookie().find((value) => value.startsWith("rm_session="))?.split(";")[0] ?? "";
  expect((await validateSession(ctx.db, sessionCookie.split("=")[1], ctx.now.value))?.user.id).toBe(user.id);
  expect(await ctx.db.select().from(sessions)).toHaveLength(2);
});

test("A: provider_id が一致する退会済みユーザーは復元し free に戻す", async () => {
  const ctx = await createTestContext();
  const [user] = await ctx.db.insert(users).values({ name: "Old", email: "old@example.test", provider: "google", providerId: "google-test-id", plan: "unlimited", deletedAt: ctx.now.value }).returning();
  const { cookie, state } = await begin(ctx);
  const res = await callback(ctx, state, cookie);
  expect(res.status).toBe(302);
  const [updated] = await ctx.db.select().from(users).where(eq(users.id, user.id));
  expect(updated).toMatchObject({ deletedAt: null, plan: "free", email: "test@example.com", name: "Test User" });
});

test.each([
  [null, "このメールアドレスは既に別のアカウントで利用されています。"],
  [new Date("2026-10-01T00:00:00Z"), "このメールアドレスは退会済みです。パスワード再設定から復元してください。"],
])("B: provider_id が違いメールだけ一致するユーザー（deletedAt=%s）は拒否する", async (deletedAt, message) => {
  const ctx = await createTestContext();
  await ctx.db.insert(users).values({ name: "Existing", email: "TEST@Example.com", provider: "google", providerId: "other", deletedAt });
  const { cookie, state } = await begin(ctx);
  const res = await callback(ctx, state, cookie);
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ message });
  expect(await ctx.db.select().from(sessions)).toHaveLength(0);
});

test("C: 新しい Google ユーザーを作ってログインする", async () => {
  const ctx = await createTestContext();
  const { cookie, state } = await begin(ctx);
  const res = await callback(ctx, state, cookie);
  expect(res.status).toBe(302);
  const [user] = await ctx.db.select().from(users);
  expect(user).toMatchObject({ name: "Test User", email: "test@example.com", password: null, plan: "free", provider: "google", providerId: "google-test-id", isAdmin: false });
  const sessionCookie = res.headers.getSetCookie().find((value) => value.startsWith("rm_session="))?.split(";")[0] ?? "";
  expect((await validateSession(ctx.db, sessionCookie.split("=")[1], ctx.now.value))?.user.id).toBe(user.id);
});

test("Google に名前がなければメールの @ より前を使う", async () => {
  const ctx = await createTestContext();
  ctx.google.nextProfile = { sub: "google-test-id", email: "Foo@Example.com", name: null };
  const { cookie, state } = await begin(ctx);
  await callback(ctx, state, cookie);
  expect((await ctx.db.select().from(users))[0].name).toBe("Foo");
});

test("JSON を受け付ける callback は 204 を返す", async () => {
  const ctx = await createTestContext();
  const { cookie, state } = await begin(ctx);
  const res = await callback(ctx, state, cookie, { Accept: "application/json" });
  expect(res.status).toBe(204);
  expect(res.headers.getSetCookie().some((value) => value.startsWith("rm_session="))).toBe(true);
});
