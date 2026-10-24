import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Hono } from "hono";
import { users } from "../db/schema";
import { jsonError } from "../lib/errors";
import { createSession, deleteUserSessions, setSessionCookie } from "../lib/session";
import { rateLimit } from "../middleware/rateLimit";
import type { AppEnv } from "../types";

const stateCookie = "rm_google_state";

const verifierCookie = "rm_google_verifier";

const cookiePath = "/api/auth/google";

const authFailed = "Google認証に失敗しました。もう一度お試しください。";

export function registerGoogleRoutes(app: Hono<AppEnv>): void {
  app.get("/auth/google/redirect", rateLimit("google", 10), (c) => {
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const cookieOptions = {
      path: cookiePath,
      maxAge: 600,
      httpOnly: true,
      secure: true,
      sameSite: "Lax" as const
    };
    setCookie(c, stateCookie, state, cookieOptions);
    setCookie(c, verifierCookie, verifier, cookieOptions);
    return c.redirect(c.var.deps.google.createAuthorizationURL(state, verifier).toString());
  });

  app.get("/auth/google/callback", rateLimit("google", 10), async (c) => {
    const expectedState = getCookie(c, stateCookie);
    const verifier = getCookie(c, verifierCookie);
    deleteCookie(c, stateCookie, {
      path: cookiePath,
      secure: true,
      httpOnly: true,
      sameSite: "Lax"
    });
    deleteCookie(c, verifierCookie, {
      path: cookiePath,
      secure: true,
      httpOnly: true,
      sameSite: "Lax"
    });
    const state = c.req.query("state");
    const code = c.req.query("code");
    if (!state || !expectedState || state !== expectedState || !code || !verifier) {
      return jsonError(c, 400, authFailed);
    }

    let profile;
    try {
      profile = await c.var.deps.google.validateCallback(code, verifier);
    } catch {
      return jsonError(c, 400, authFailed);
    }
    if (!profile.email) {
      return jsonError(c, 422, "Googleアカウントにメールアドレスがありません。別のアカウントをお試しください。");
    }

    const deps = c.var.deps;
    const name = profile.name || profile.email.split("@")[0] || "User";
    const [matched] = await deps.db.select().from(users)
      .where(and(eq(users.provider, "google"), eq(users.providerId, profile.sub))).limit(1);
    let user;
    if (matched) {
      if (matched.deletedAt) {
        await deleteUserSessions(deps.db, matched.id);
      }
      [user] = await deps.db.update(users).set({
        deletedAt: null,
        ...(matched.deletedAt ? { plan: "free" } : {}),
        provider: "google",
        providerId: profile.sub,
        email: profile.email,
        name,
      }).where(eq(users.id, matched.id)).returning();
    } else {
      const [byEmail] = await deps.db.select().from(users)
        .where(eq(sql`lower(${users.email})`, profile.email.toLowerCase())).limit(1);
      if (byEmail) {
        return jsonError(c, 422, byEmail.deletedAt
          ? "このメールアドレスは退会済みです。パスワード再設定から復元してください。"
          : "このメールアドレスは既に別のアカウントで利用されています。");
      }
      [user] = await deps.db.insert(users).values({
        name,
        email: profile.email,
        password: null,
        plan: "free",
        provider: "google",
        providerId: profile.sub,
        isAdmin: false,
      }).returning();
    }
    const sessionToken = await createSession(deps.db, user.id, deps.now?.() ?? new Date());
    setSessionCookie(c, sessionToken);
    if (c.req.header("accept")?.includes("application/json")) {
      return c.body(null, 204);
    }
    return c.redirect(new URL("/routines", deps.appUrl).toString());
  });
}
