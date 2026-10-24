import { isIP } from "node:net";
import { lt, sql } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { rateLimits } from "../db/schema";
import { jsonError } from "../lib/errors";
import type { AppEnv } from "../types";

export function rateLimit(bucket: string, max: number): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const deps = c.var.deps;
    const now = deps.now?.() ?? new Date();
    const windowStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
    const candidate = (
      c.req.header("x-forwarded-for")?.split(",")[0] ?? c.req.header("x-real-ip") ?? ""
    ).trim();
    const ip = candidate.length <= 45 && isIP(candidate) ? candidate : "unknown";
    const key = `${bucket}:${ip}`;
    // 固定窓では境目の前後に最大2倍通り得るが、競合する要求を1回の更新で正確に数えるため。
    const [row] = await deps.db.insert(rateLimits).values({
      key,
      windowStart,
      count: 1
    })
      .onConflictDoUpdate({
        target: [rateLimits.key, rateLimits.windowStart],
        set: { count: sql`${rateLimits.count} + 1` }
      })
      .returning({ count: rateLimits.count });
    // 毎回の削除は DB 負荷を増やすため、古い窓の掃除は低頻度にする。
    if (Math.random() < 0.01) {
      await deps.db.delete(rateLimits)
        .where(lt(rateLimits.windowStart, new Date(windowStart.getTime() - 60_000)));
    }
    if (row.count > max) {
      return jsonError(c, 429, "Too Many Attempts.");
    }
    await next();
  };
}
