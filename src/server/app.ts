import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppDeps, AppEnv } from "./types";
import { jsonError } from "./lib/errors";
import { csrf } from "./middleware/csrf";
import { registerAuthRoutes } from "./routes/auth";
import { registerGoogleRoutes } from "./routes/google";
import { registerMeRoutes } from "./routes/me";
import { registerSettingsRoutes } from "./routes/settings";
import { registerAdminRoutes } from "./routes/admin";
import { registerRoutineRoutes } from "./routes/routines";
import { registerHistoryRoutes } from "./routes/histories";

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>().basePath("/api");
  app.use("*", async (c, next) => {
    c.set("deps", deps);
    await next();
  });
  app.use("*", csrf);
  app.use("*", bodyLimit({ maxSize: 64 * 1024, onError: (c) => jsonError(c, 413, "Payload Too Large.") }));
  app.get("/health", (c) => c.json({ status: "ok" }));
  registerAuthRoutes(app);
  registerGoogleRoutes(app);
  registerMeRoutes(app);
  registerSettingsRoutes(app);
  registerRoutineRoutes(app);
  registerHistoryRoutes(app);
  registerAdminRoutes(app);
  app.notFound((c) => jsonError(c, 404, "Not Found."));
  app.onError((error, c) => {
    console.error(error);
    return jsonError(c, 500, "Server Error");
  });
  return app;
}
