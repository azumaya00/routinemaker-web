import type { MiddlewareHandler } from "hono";
import { jsonError } from "../lib/errors";
import type { AppEnv } from "../types";

export const csrf: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const expected = new URL(c.var.deps.appUrl).origin;
    if (c.req.header("origin") !== expected) return jsonError(c, 403, "Forbidden.");
  }
  await next();
};
