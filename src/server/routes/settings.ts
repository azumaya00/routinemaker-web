import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import type { Db } from "../db/client";
import { userSettings, type UserSettingsRow } from "../db/schema";
import { validationError, validationMessage } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

export async function getOrCreateSettings(db: Db, userId: number, now: Date): Promise<UserSettingsRow> {
  const [existing] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  if (existing) return existing;
  await db.insert(userSettings).values({ userId, createdAt: now, updatedAt: now }).onConflictDoNothing({ target: userSettings.userId });
  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return settings;
}

export function settingsResponse(settings: UserSettingsRow) {
  return {
    id: settings.id,
    user_id: settings.userId,
    theme: settings.theme,
    dark_mode: settings.darkMode,
    show_remaining_tasks: settings.showRemainingTasks,
    show_elapsed_time: settings.showElapsedTime,
    show_celebration: settings.showCelebration,
    created_at: settings.createdAt?.toISOString() ?? null,
    updated_at: settings.updatedAt?.toISOString() ?? null,
  };
}

type SettingUpdate = Partial<Pick<UserSettingsRow, "theme" | "darkMode" | "showRemainingTasks" | "showElapsedTime" | "showCelebration">>;
const booleanFields = ["show_remaining_tasks", "show_elapsed_time", "show_celebration"] as const;

function isLaravelBoolean(value: unknown): value is boolean | number | string {
  return value === true || value === false || value === 1 || value === 0 || value === "1" || value === "0";
}

export function registerSettingsRoutes(app: Hono<AppEnv>): void {
  app.get("/settings", requireAuth, async (c) => {
    const settings = await getOrCreateSettings(c.var.deps.db, c.var.user.id, c.var.deps.now?.() ?? new Date());
    return c.json({ data: settingsResponse(settings) });
  });

  app.patch("/settings", requireAuth, async (c) => {
    const deps = c.var.deps;
    const now = deps.now?.() ?? new Date();
    const settings = await getOrCreateSettings(deps.db, c.var.user.id, now);
    const body: unknown = await c.req.json().catch(() => ({}));
    const input = body !== null && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
    const errors: Record<string, string[]> = {};
    if ("theme" in input && !["light", "soft", "dark"].includes(input.theme as string)) {
      errors.theme = [validationMessage("in", "theme")];
    }
    if ("dark_mode" in input && !["off", "on", "system"].includes(input.dark_mode as string)) {
      errors.dark_mode = [validationMessage("in", "dark_mode")];
    }
    for (const field of booleanFields) {
      if (field in input && !isLaravelBoolean(input[field])) errors[field] = [validationMessage("boolean", field)];
    }
    if (Object.keys(errors).length > 0) return validationError(c, errors);

    const update: SettingUpdate = {};
    if ("theme" in input) update.theme = input.theme as string;
    if ("dark_mode" in input) update.darkMode = input.dark_mode as string;
    if ("show_remaining_tasks" in input) update.showRemainingTasks = [true, 1, "1"].includes(input.show_remaining_tasks as boolean);
    if ("show_elapsed_time" in input) update.showElapsedTime = [true, 1, "1"].includes(input.show_elapsed_time as boolean);
    if ("show_celebration" in input) update.showCelebration = [true, 1, "1"].includes(input.show_celebration as boolean);
    if (Object.keys(update).length === 0) return c.json({ data: settingsResponse(settings) });
    const [saved] = await deps.db.update(userSettings).set({ ...update, updatedAt: now }).where(eq(userSettings.id, settings.id)).returning();
    return c.json({ data: settingsResponse(saved) });
  });
}
