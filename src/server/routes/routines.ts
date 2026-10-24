import { and, asc, count, eq } from "drizzle-orm";
import type { Hono } from "hono";
import type { Db } from "../db/client";
import { routines, type RoutineRow } from "../db/schema";
import { jsonError, validationError, validationMessage } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

export async function findOwnRoutine(
  db: Db,
  userId: number,
  idParam: string,
): Promise<RoutineRow | null> {
  if (!/^\d+$/.test(idParam)) {
    return null;
  }
  const id = Number(idParam);
  if (!Number.isSafeInteger(id)) {
    return null;
  }
  const [routine] = await db.select().from(routines)
    .where(and(eq(routines.id, id), eq(routines.userId, userId)))
    .limit(1);
  return routine ?? null;
}

function routineResponse(routine: RoutineRow) {
  return {
    id: routine.id,
    user_id: routine.userId,
    title: routine.title,
    tasks: routine.tasks,
    created_at: routine.createdAt?.toISOString() ?? null,
    updated_at: routine.updatedAt?.toISOString() ?? null,
  };
}

function characterCount(value: string): number {
  // Laravel の文字数制限と絵文字の数え方を揃えるため。
  return Array.from(value).length;
}

function validateRoutine(input: Record<string, unknown>, isUpdate: boolean, plan: string) {
  const errors: Record<string, string[]> = {};
  const title = input.title;
  if (
    (!isUpdate && (title === undefined || title === null || title === "")) ||
    (isUpdate && "title" in input && (title === null || title === ""))
  ) {
    errors.title = [validationMessage("required", "title")];
  } else if ("title" in input) {
    if (typeof title !== "string") {
      errors.title = [validationMessage("string", "title")];
    } else if (characterCount(title) > 255) {
      errors.title = [validationMessage("max:255", "title")];
    }
  }

  const tasks = input.tasks;
  if (
    (!isUpdate && (
      tasks === undefined || tasks === null || (Array.isArray(tasks) && tasks.length === 0)
    )) ||
    (isUpdate && "tasks" in input && (
      tasks === null || (Array.isArray(tasks) && tasks.length === 0)
    ))
  ) {
    errors.tasks = [validationMessage("required", "tasks")];
  } else if ("tasks" in input) {
    if (!Array.isArray(tasks)) {
      errors.tasks = [validationMessage("array", "tasks")];
    } else {
      tasks.forEach((task: unknown, index: number) => {
        const field = `tasks.${index}`;
        if (typeof task !== "string") {
          errors[field] = [validationMessage("string", field)];
        } else if (characterCount(task) > 255) {
          errors[field] = [validationMessage("max:255", field)];
        }
      });
      if (tasks.length > 100) {
        errors.tasks = [
          ...(errors.tasks ?? []),
          "The tasks field must not have more than 100 items.",
        ];
      } else if (plan !== "unlimited" && tasks.length > 10) {
        errors.tasks = [...(errors.tasks ?? []), "Tasks must not exceed 10 for this plan."];
      }
    }
  }
  return errors;
}

export function registerRoutineRoutes(app: Hono<AppEnv>): void {
  app.get("/routines", requireAuth, async (c) => {
    const rows = await c.var.deps.db.select().from(routines)
      .where(eq(routines.userId, c.var.user.id))
      .orderBy(asc(routines.id));
    return c.json({ data: rows.map(routineResponse) });
  });

  app.post("/routines", requireAuth, async (c) => {
    const { db } = c.var.deps;
    const user = c.var.user;
    if (user.plan === "free") {
      const [{ value }] = await db.select({ value: count() }).from(routines)
        .where(eq(routines.userId, user.id));
      if (value >= 10) {
        return jsonError(c, 422, "無料プランではタスクリストは10件までです。");
      }
    }
    const body: unknown = await c.req.json().catch(() => ({}));
    const input = body !== null && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {};
    const errors = validateRoutine(input, false, user.plan);
    if (Object.keys(errors).length) {
      return validationError(c, errors);
    }
    const now = c.var.deps.now?.() ?? new Date();
    const [created] = await db.insert(routines).values({
      userId: user.id,
      title: input.title as string,
      tasks: input.tasks as string[],
      createdAt: now,
      updatedAt: now
    }).returning();
    return c.json({ data: routineResponse(created) }, 201);
  });

  app.get("/routines/:id", requireAuth, async (c) => {
    const routine = await findOwnRoutine(c.var.deps.db, c.var.user.id, c.req.param("id"));
    if (!routine) {
      return jsonError(c, 404, "Not Found.");
    }
    return c.json({ data: routineResponse(routine) });
  });

  app.patch("/routines/:id", requireAuth, async (c) => {
    const { db } = c.var.deps;
    const routine = await findOwnRoutine(db, c.var.user.id, c.req.param("id"));
    if (!routine) {
      return jsonError(c, 404, "Not Found.");
    }
    const body: unknown = await c.req.json().catch(() => ({}));
    const input = body !== null && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {};
    const errors = validateRoutine(input, true, c.var.user.plan);
    if (Object.keys(errors).length) {
      return validationError(c, errors);
    }
    const update: Partial<Pick<RoutineRow, "title" | "tasks">> = {};
    if ("title" in input) {
      update.title = input.title as string;
    }
    if ("tasks" in input) {
      update.tasks = input.tasks as string[];
    }
    if (Object.keys(update).length === 0) {
      return c.json({ data: routineResponse(routine) });
    }
    const now = c.var.deps.now?.() ?? new Date();
    const [saved] = await db.update(routines).set({
      ...update,
      updatedAt: now
    }).where(eq(routines.id, routine.id)).returning();
    return c.json({ data: routineResponse(saved) });
  });

  app.delete("/routines/:id", requireAuth, async (c) => {
    const { db } = c.var.deps;
    const routine = await findOwnRoutine(db, c.var.user.id, c.req.param("id"));
    if (!routine) {
      return jsonError(c, 404, "Not Found.");
    }
    await db.delete(routines).where(eq(routines.id, routine.id));
    return c.json({ data: { deleted: true } });
  });
}
