import { eq, sql } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { getCookie } from "hono/cookie";
import type { Hono } from "hono";
import { z } from "zod";
import { users } from "../db/schema";
import { jsonError, validationError, validationMessage } from "../lib/errors";
import { hashPassword, verifyPassword } from "../lib/password";
import { clearSessionCookie, createSession, deleteSession, SESSION_COOKIE, setSessionCookie, validateSession } from "../lib/session";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import type { AppEnv } from "../types";

const emailRule = z.email();

function addIssue(ctx: z.RefinementCtx, field: string, message: string) {
  ctx.addIssue({ code: "custom", path: [field], message });
}

function checkEmail(ctx: z.RefinementCtx, value: unknown, register: boolean) {
  const required = register ? "メールアドレスは必須です。" : validationMessage("required", "email");
  const invalid = register ? "有効なメールアドレスを入力してください。" : validationMessage("email", "email");
  if (value === undefined || value === null || value === "") addIssue(ctx, "email", required);
  else if (!emailRule.safeParse(value).success) addIssue(ctx, "email", invalid);
}

const loginSchema = z.object({ email: z.unknown().optional(), password: z.unknown().optional() }).superRefine((value, ctx) => {
  checkEmail(ctx, value.email, false);
  if (value.password === undefined || value.password === null || value.password === "") {
    addIssue(ctx, "password", validationMessage("required", "password"));
  } else if (typeof value.password !== "string") {
    addIssue(ctx, "password", validationMessage("string", "password"));
  }
});

const registerSchema = z.object({
  email: z.unknown().optional(), password: z.unknown().optional(), password_confirmation: z.unknown().optional(),
}).superRefine((value, ctx) => {
  checkEmail(ctx, value.email, true);
  const password = value.password;
  if (password === undefined || password === null || password === "") {
    addIssue(ctx, "password", "パスワードは必須です。");
    return;
  }
  if (typeof password !== "string") {
    addIssue(ctx, "password", validationMessage("string", "password"));
    return;
  }
  if (password !== value.password_confirmation) addIssue(ctx, "password", "パスワードが一致しません。");
  if (password.length < 8) addIssue(ctx, "password", "パスワードは8文字以上である必要があります。");
  if (!/[a-zA-Z]/.test(password)) addIssue(ctx, "password", "パスワードには英字が含まれている必要があります。");
  if (!/[0-9]/.test(password)) addIssue(ctx, "password", "パスワードには数字が含まれている必要があります。");
});

function validateBody(schema: typeof loginSchema | typeof registerSchema) {
  return zValidator("json", schema, (result, c) => {
    if (result.success) return;
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const field = String(issue.path[0]);
      (errors[field] ??= []).push(issue.message);
    }
    return validationError(c, errors);
  });
}

export function registerAuthRoutes(app: Hono<AppEnv>): void {
  app.post("/login", rateLimit("login", 10), async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) {
      const session = await validateSession(c.var.deps.db, token, c.var.deps.now?.() ?? new Date());
      if (session) {
        const res = c.body(null, 204);
        if (session.extended) setSessionCookie(c, token);
        return res;
      }
    }
    await next();
  }, validateBody(loginSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const deps = c.var.deps;
    const [user] = await deps.db.select().from(users)
      .where(eq(sql`lower(${users.email})`, (email as string).toLowerCase())).limit(1);
    if (!user || user.deletedAt || !await verifyPassword(password as string, user.password)) {
      return jsonError(c, 422, "メールアドレスまたはパスワードが正しくありません。");
    }
    const token = await createSession(deps.db, user.id, deps.now?.() ?? new Date());
    setSessionCookie(c, token);
    return c.body(null, 204);
  });

  app.post("/register", rateLimit("register", 10), validateBody(registerSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const deps = c.var.deps;
    const [existing] = await deps.db.select().from(users)
      .where(eq(sql`lower(${users.email})`, (email as string).toLowerCase())).limit(1);
    if (existing) {
      return jsonError(c, 422, existing.deletedAt
        ? "このメールアドレスは退会済みです。パスワード再設定から復元してください。"
        : "このメールアドレスは既に登録されています。");
    }
    const [user] = await deps.db.insert(users).values({
      name: (email as string).split("@")[0] || "User",
      email: email as string,
      password: await hashPassword(password as string),
      isAdmin: false,
    }).returning();
    const token = await createSession(deps.db, user.id, deps.now?.() ?? new Date());
    setSessionCookie(c, token);
    return c.body(null, 204);
  });

  app.post("/logout", requireAuth, async (c) => {
    await deleteSession(c.var.deps.db, c.var.sessionToken);
    clearSessionCookie(c);
    return c.body(null, 204);
  });
}
