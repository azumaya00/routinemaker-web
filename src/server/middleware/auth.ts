import { getCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";
import { jsonError } from "../lib/errors";
import { SESSION_COOKIE, setSessionCookie, validateSession } from "../lib/session";
import type { AppEnv } from "../types";

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return jsonError(c, 401, "Unauthenticated.");
  const deps = c.var.deps;
  const session = await validateSession(deps.db, token, deps.now?.() ?? new Date());
  if (!session) return jsonError(c, 401, "Unauthenticated.");
  c.set("user", session.user);
  c.set("sessionToken", token);
  await next();
  if (session.extended) setSessionCookie(c, token);
};
