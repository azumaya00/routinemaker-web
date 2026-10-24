import { and, eq, isNull } from "drizzle-orm";
import type { Hono } from "hono";
import { users } from "../db/schema";
import { validationError, validationMessage } from "../lib/errors";
import { verifyPassword } from "../lib/password";
import { clearSessionCookie, deleteUserSessions } from "../lib/session";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";
import { getOrCreateSettings, settingsResponse } from "./settings";

export function registerMeRoutes(app: Hono<AppEnv>): void {
  app.get("/me", requireAuth, async (c) => {
    const user = c.var.user;
    const settings = await getOrCreateSettings(
      c.var.deps.db,
      user.id,
      c.var.deps.now?.() ?? new Date(),
    );
    return c.json({
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          plan: user.plan,
          is_admin: user.isAdmin,
          has_password: user.password !== null,
          provider: user.provider,
          tutorial_dismissed_at: user.tutorialDismissedAt?.toISOString() ?? null,
          tutorial_should_show: user.tutorialDismissedAt === null,
        },
        plan: user.plan,
        settings: settingsResponse(settings),
      }
    });
  });

  app.delete("/me", requireAuth, async (c) => {
    const user = c.var.user;
    const body: unknown = await c.req.json().catch(() => ({}));
    const input = body !== null && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {};
    const password = input.password;
    if (user.password !== null) {
      if (password === undefined || password === null || password === "") {
        return validationError(c, { password: ["パスワードは必須です。"] });
      }
      if (typeof password !== "string") {
        return validationError(c, { password: [validationMessage("string", "password")] });
      }
      // bcrypt は72バイト以降を無視するため、照合前に拒否する。
      if (Buffer.byteLength(password, "utf8") > 72) {
        return validationError(c, {
          password: ["The password field must not be greater than 72 characters."],
        });
      }
      if (!await verifyPassword(password, user.password)) {
        return validationError(c, { password: ["パスワードが一致しません。"] });
      }
    } else if (password !== undefined && password !== null && typeof password !== "string") {
      return validationError(c, { password: [validationMessage("string", "password")] });
    }
    if (typeof password === "string" && Buffer.byteLength(password, "utf8") > 72) {
      return validationError(c, {
        password: ["The password field must not be greater than 72 characters."],
      });
    }
    const deps = c.var.deps;
    const now = deps.now?.() ?? new Date();
    await deps.db.update(users).set({
      deletedAt: now,
      updatedAt: now
    }).where(eq(users.id, user.id));
    await deleteUserSessions(deps.db, user.id);
    c.set("sessionRevoked", true);
    clearSessionCookie(c);
    return c.body(null, 204);
  });

  app.post("/tutorial/dismiss", requireAuth, async (c) => {
    const deps = c.var.deps;
    const user = c.var.user;
    if (user.tutorialDismissedAt === null) {
      const now = deps.now?.() ?? new Date();
      await deps.db.update(users).set({
        tutorialDismissedAt: now,
        updatedAt: now
      })
        .where(and(eq(users.id, user.id), isNull(users.tutorialDismissedAt)));
    }
    const [saved] = await deps.db.select({ tutorialDismissedAt: users.tutorialDismissedAt })
      .from(users).where(eq(users.id, user.id)).limit(1);
    return c.json({
      data: {
        tutorial_dismissed_at: saved.tutorialDismissedAt?.toISOString(),
        tutorial_should_show: false
      }
    });
  });
}
