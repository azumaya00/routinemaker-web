import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, test, vi } from "vitest";
import { passwordResetTokens, sessions, users } from "@/server/db/schema";
import { hashPassword, verifyPassword } from "@/server/lib/password";
import { createTestContext, loginAs } from "./helpers";

type Context = Awaited<ReturnType<typeof createTestContext>>;
const success = { message: "パスワードリセットリンクを送信しました。メールをご確認ください。" };
const failure = { message: "パスワードリセットに失敗しました。リンクが無効または期限切れの可能性があります。" };

function post(ctx: Context, path: string, body: object) {
  return ctx.app.request(path, {
    method: "POST",
    headers: { Origin: "https://routinemaker.test", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function requestToken(ctx: Context, email: string) {
  const response = await post(ctx, "/api/forgot-password", { email });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(success);
  const link = new URL(ctx.mailer.sent.at(-1)!.text.match(/https:\/\/\S+/)![0]);
  return link.searchParams.get("token")!;
}

test("登録済みメールへリンクを送り、トークンのハッシュを小文字メールで保存する", async () => {
  const ctx = await createTestContext();
  await loginAs(ctx, { email: "Foo+bar@Example.com" });
  const token = await requestToken(ctx, "foo+bar@example.com");
  expect(ctx.mailer.sent).toHaveLength(1);
  expect(ctx.mailer.sent[0].to).toBe("Foo+bar@Example.com");
  const link = new URL(ctx.mailer.sent[0].text.match(/https:\/\/\S+/)![0]);
  expect(link.origin + link.pathname).toBe("https://routinemaker.test/reset-password");
  expect(link.searchParams.get("email")).toBe("Foo+bar@Example.com");
  expect(token).toMatch(/^[0-9a-f]{64}$/);
  expect(await ctx.db.select().from(passwordResetTokens)).toMatchObject([{ email: "foo+bar@example.com", token: createHash("sha256").update(token).digest("hex") }]);
});

test("存在しないメールには同じ成功応答を返し送信しない", async () => {
  const ctx = await createTestContext();
  const response = await post(ctx, "/api/forgot-password", { email: "missing@example.com" });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(success);
  expect(ctx.mailer.sent).toHaveLength(0);
});

test("退会済みユーザーにも送る", async () => {
  const ctx = await createTestContext();
  await ctx.db.insert(users).values({ name: "Former", email: "former@example.com", deletedAt: ctx.now.value });
  await requestToken(ctx, "former@example.com");
  expect(ctx.mailer.sent).toHaveLength(1);
});

test("60秒以内の再申請は抑制し、61秒後に送る", async () => {
  const ctx = await createTestContext();
  await loginAs(ctx, { email: "member@example.com" });
  await requestToken(ctx, "member@example.com");
  ctx.now.value = new Date(ctx.now.value.getTime() + 59_000);
  const second = await post(ctx, "/api/forgot-password", { email: "member@example.com" });
  expect(second.status).toBe(200);
  expect(await second.json()).toEqual(success);
  expect(ctx.mailer.sent).toHaveLength(1);
  ctx.now.value = new Date(ctx.now.value.getTime() + 2_000);
  await requestToken(ctx, "member@example.com");
  expect(ctx.mailer.sent).toHaveLength(2);
});

test("送信失敗を記録して同じ成功応答を返す", async () => {
  const ctx = await createTestContext();
  await loginAs(ctx, { email: "member@example.com" });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  ctx.mailer.send = async () => { throw new Error("smtp failed"); };
  try {
    const response = await post(ctx, "/api/forgot-password", { email: "member@example.com" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(success);
    expect(log).toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});

test.each([
  [{}, "メールアドレスは必須です。"],
  [{ email: "invalid" }, "有効なメールアドレスを入力してください。"],
])("申請メールの検証は Laravel の 422", async (body, message) => {
  const ctx = await createTestContext();
  const response = await post(ctx, "/api/forgot-password", body);
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({ message, errors: { email: [message] } });
});

test("正しいトークンでパスワードを変え、セッションとトークンを削除する", async () => {
  const ctx = await createTestContext();
  const { user } = await loginAs(ctx, { email: "member@example.com", password: await hashPassword("oldpassword1") });
  const token = await requestToken(ctx, "member@example.com");
  const response = await post(ctx, "/api/reset-password", { token, email: "MEMBER@example.com", password: "newpassword1", password_confirmation: "newpassword1" });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ message: "パスワードをリセットしました。" });
  const [updated] = await ctx.db.select().from(users).where(eq(users.id, user.id));
  expect(await verifyPassword("newpassword1", updated.password)).toBe(true);
  expect(await ctx.db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
  const login = await post(ctx, "/api/login", { email: "member@example.com", password: "newpassword1" });
  expect(login.status).toBe(204);
  expect(await ctx.db.select().from(passwordResetTokens)).toHaveLength(0);
});

test("退会済みユーザーは再設定で復帰する", async () => {
  const ctx = await createTestContext();
  const [user] = await ctx.db.insert(users).values({ name: "Former", email: "former@example.com", deletedAt: ctx.now.value }).returning();
  const token = await requestToken(ctx, "former@example.com");
  const response = await post(ctx, "/api/reset-password", { token, email: "former@example.com", password: "newpassword1", password_confirmation: "newpassword1" });
  expect(response.status).toBe(200);
  const [updated] = await ctx.db.select().from(users).where(eq(users.id, user.id));
  expect(updated.deletedAt).toBeNull();
  expect(await verifyPassword("newpassword1", updated.password)).toBe(true);
});

test.each(["expired", "invalid"])("%s トークンは 422", async (kind) => {
  const ctx = await createTestContext();
  await loginAs(ctx, { email: "member@example.com" });
  const token = await requestToken(ctx, "member@example.com");
  if (kind === "expired") ctx.now.value = new Date(ctx.now.value.getTime() + 61 * 60_000);
  const response = await post(ctx, "/api/reset-password", { token: kind === "invalid" ? "a".repeat(64) : token, email: "member@example.com", password: "newpassword1", password_confirmation: "newpassword1" });
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual(failure);
});

test.each([
  [{ email: "member@example.com", password: "newpassword1", password_confirmation: "newpassword1" }, "token", "トークンは必須です。"],
  [{ token: "abc", password: "newpassword1", password_confirmation: "newpassword1" }, "email", "メールアドレスは必須です。"],
  [{ token: "abc", email: "bad", password: "newpassword1", password_confirmation: "newpassword1" }, "email", "有効なメールアドレスを入力してください。"],
  [{ token: "abc", email: "member@example.com" }, "password", "パスワードは必須です。"],
  [{ token: "abc", email: "member@example.com", password: "newpassword1", password_confirmation: "different" }, "password", "パスワードが一致しません。"],
])("再設定の入力違反は Laravel の 422", async (body, field, message) => {
  const ctx = await createTestContext();
  const response = await post(ctx, "/api/reset-password", body);
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({ message, errors: { [field]: [message] } });
});

test("再設定パスワードの複数違反は登録と同じ順序で返す", async () => {
  const ctx = await createTestContext();
  const response = await post(ctx, "/api/reset-password", { token: "abc", email: "member@example.com", password: "abc", password_confirmation: "abc" });
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({
    message: "パスワードは8文字以上である必要があります。 (and 1 more error)",
    errors: { password: ["パスワードは8文字以上である必要があります。", "パスワードには数字が含まれている必要があります。"] },
  });
});
