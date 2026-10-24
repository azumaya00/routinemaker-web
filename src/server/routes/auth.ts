import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { getCookie } from "hono/cookie";
import type { Hono } from "hono";
import { z } from "zod";
import { passwordResetTokens, users } from "../db/schema";
import { jsonError, validationError, validationMessage } from "../lib/errors";
import { hashPassword, verifyPassword } from "../lib/password";
import { buildResetPasswordMail } from "../lib/mail";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  deleteUserSessions,
  SESSION_COOKIE,
  setSessionCookie,
  validateSession,
} from "../lib/session";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import type { AppEnv } from "../types";

const emailRule = z.email();

function addIssue(ctx: z.RefinementCtx, field: string, message: string) {
  ctx.addIssue({
    code: "custom",
    path: [field],
    message
  });
}

function checkEmail(ctx: z.RefinementCtx, value: unknown, register: boolean) {
  const required = register ? "メールアドレスは必須です。" : validationMessage("required", "email");
  const invalid = register ? "有効なメールアドレスを入力してください。" : validationMessage("email", "email");
  if (value === undefined || value === null || value === "") {
    addIssue(ctx, "email", required);
  } else if (typeof value === "string" && Array.from(value).length > 255) {
    addIssue(ctx, "email", validationMessage("max:255", "email"));
  } else if (!emailRule.safeParse(value).success) {
    addIssue(ctx, "email", invalid);
  }
}

function checkPassword(ctx: z.RefinementCtx, password: unknown, confirmation: unknown) {
  if (password === undefined || password === null || password === "") {
    addIssue(ctx, "password", "パスワードは必須です。");
    return;
  }
  if (typeof password !== "string") {
    addIssue(ctx, "password", validationMessage("string", "password"));
    return;
  }
  // bcrypt は72バイト以降を無視するため、ハッシュ化前に拒否する。
  if (Buffer.byteLength(password, "utf8") > 72) {
    addIssue(ctx, "password", "The password field must not be greater than 72 characters.");
    return;
  }
  if (password !== confirmation) {
    addIssue(ctx, "password", "パスワードが一致しません。");
  }
  if (password.length < 8) {
    addIssue(ctx, "password", "パスワードは8文字以上である必要があります。");
  }
  if (!/[a-zA-Z]/.test(password)) {
    addIssue(ctx, "password", "パスワードには英字が含まれている必要があります。");
  }
  if (!/[0-9]/.test(password)) {
    addIssue(ctx, "password", "パスワードには数字が含まれている必要があります。");
  }
}

const loginSchema = z.object({
  email: z.unknown().optional(),
  password: z.unknown().optional()
}).superRefine((value, ctx) => {
  checkEmail(ctx, value.email, false);
  if (value.password === undefined || value.password === null || value.password === "") {
    addIssue(ctx, "password", validationMessage("required", "password"));
  } else if (typeof value.password !== "string") {
    addIssue(ctx, "password", validationMessage("string", "password"));
  } else if (Buffer.byteLength(value.password, "utf8") > 72) {
    addIssue(ctx, "password", "The password field must not be greater than 72 characters.");
  }
});

const registerSchema = z.object({
  email: z.unknown().optional(),
  password: z.unknown().optional(),
  password_confirmation: z.unknown().optional(),
}).superRefine((value, ctx) => {
  checkEmail(ctx, value.email, true);
  checkPassword(ctx, value.password, value.password_confirmation);
});

const forgotPasswordSchema = z.object({
  email: z.unknown().optional(),
}).superRefine((value, ctx) => {
  checkEmail(ctx, value.email, true);
});

const resetPasswordSchema = z.object({
  token: z.unknown().optional(),
  email: z.unknown().optional(),
  password: z.unknown().optional(),
  password_confirmation: z.unknown().optional(),
}).superRefine((value, ctx) => {
  if (value.token === undefined || value.token === null || value.token === "") {
    addIssue(ctx, "token", "トークンは必須です。");
  } else if (typeof value.token !== "string") {
    addIssue(ctx, "token", validationMessage("string", "token"));
  } else if (Array.from(value.token).length > 255) {
    addIssue(ctx, "token", validationMessage("max:255", "token"));
  }
  checkEmail(ctx, value.email, true);
  checkPassword(ctx, value.password, value.password_confirmation);
});

function validateBody(
  schema: typeof loginSchema | typeof registerSchema |
    typeof forgotPasswordSchema | typeof resetPasswordSchema,
) {
  return zValidator("json", schema, (result, c) => {
    if (result.success) {
      return;
    }
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
        const response = c.body(null, 204);
        if (session.extended) {
          setSessionCookie(c, token);
        }
        return response;
      }
    }
    await next();
  }, validateBody(loginSchema), async (c) => {
    const { email, password } = c.req.valid("json") as {
      email: string;
      password: string
    };
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
    const { email, password } = c.req.valid("json") as {
      email: string;
      password: string
    };
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
    c.set("sessionRevoked", true);
    clearSessionCookie(c);
    return c.body(null, 204);
  });

  app.post("/forgot-password", rateLimit("password", 5),
    validateBody(forgotPasswordSchema), async (c) => {
    const deps = c.var.deps;
    const email = c.req.valid("json").email as string;
    const [user] = await deps.db.select().from(users)
      .where(eq(sql`lower(${users.email})`, email.toLowerCase())).limit(1);
    const message = { message: "パスワードリセットリンクを送信しました。メールをご確認ください。" };
    if (!user) {
      return c.json(message);
    }

    const now = deps.now?.() ?? new Date();
    const key = user.email.toLowerCase();
    const [previous] = await deps.db.select().from(passwordResetTokens)
      .where(eq(passwordResetTokens.email, key)).limit(1);
    if (previous?.createdAt && previous.createdAt.getTime() > now.getTime() - 60_000) {
      return c.json(message);
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await deps.db.insert(passwordResetTokens).values({
      email: key,
      token: tokenHash,
      createdAt: now
    })
      .onConflictDoUpdate({
        target: passwordResetTokens.email,
        set: {
          token: tokenHash,
          createdAt: now
        }
      });
    const resetUrl = new URL("/reset-password", deps.appUrl);
    resetUrl.searchParams.set("token", token);
    resetUrl.searchParams.set("email", user.email);
    try {
      await deps.mailer.send({
        to: user.email,
        ...buildResetPasswordMail(resetUrl.toString())
      });
    } catch (error) {
      console.error(error);
    }
    return c.json(message);
  });

  app.post("/reset-password", rateLimit("password", 5),
    validateBody(resetPasswordSchema), async (c) => {
    const { token, email, password } = c.req.valid("json") as {
      token: string;
      email: string;
      password: string
    };
    const deps = c.var.deps;
    const key = (email as string).toLowerCase();
    const [user] = await deps.db.select().from(users)
      .where(eq(sql`lower(${users.email})`, key)).limit(1);
    const [stored] = await deps.db.select().from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.email, key),
        gte(
          passwordResetTokens.createdAt,
          new Date((deps.now?.() ?? new Date()).getTime() - 60 * 60_000),
        ),
      ))
      .limit(1);
    const candidate = createHash("sha256").update(token as string).digest();
    if (!user || !stored || !timingSafeEqual(candidate, Buffer.from(stored.token, "hex"))) {
      return jsonError(c, 422, "パスワードリセットに失敗しました。リンクが無効または期限切れの可能性があります。");
    }
    await deps.db.update(users).set({
      password: await hashPassword(password as string),
      deletedAt: null
    })
      .where(eq(users.id, user.id));
    await deps.db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, key));
    await deleteUserSessions(deps.db, user.id);
    return c.json({ message: "パスワードをリセットしました。" });
  });
}
