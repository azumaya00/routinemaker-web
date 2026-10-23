import { and, count, eq, gt, lt } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { rateLimits } from "../db/schema";
import { jsonError } from "../lib/errors";
import type { AppEnv } from "../types";

export function rateLimit(bucket: string, max: number): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const deps = c.var.deps;
    const now = deps.now?.() ?? new Date();
    const cutoff = new Date(now.getTime() - 60_000);
    const ip = c.req.header("x-forwarded-for")?.split(",")[0].trim() || c.req.header("x-real-ip") || "unknown";
    const key = `${bucket}:${ip}`;
    const [{ attempts }] = await deps.db.select({ attempts: count() }).from(rateLimits)
      .where(and(eq(rateLimits.key, key), gt(rateLimits.createdAt, cutoff)));
    if (attempts >= max) return jsonError(c, 429, "Too Many Attempts.");
    await deps.db.insert(rateLimits).values({ key, createdAt: now });
    await deps.db.delete(rateLimits).where(lt(rateLimits.createdAt, cutoff));
    await next();
  };
}
