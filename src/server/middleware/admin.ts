import type { MiddlewareHandler } from "hono";
import { jsonError } from "../lib/errors";
import type { AppEnv } from "../types";

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.var.user?.isAdmin) return jsonError(c, 403, "管理者権限が必要です。");
  await next();
};
