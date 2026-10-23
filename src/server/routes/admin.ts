import type { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import type { AppEnv } from "../types";

export function registerAdminRoutes(app: Hono<AppEnv>): void {
  app.get("/admin/ping", requireAuth, requireAdmin, (c) => c.json({
    message: "Admin access granted",
    user: { id: c.var.user.id, email: c.var.user.email, is_admin: c.var.user.isAdmin },
  }));
}
