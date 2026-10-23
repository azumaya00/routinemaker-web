import { Hono } from "hono";
import type { AppDeps, AppEnv } from "./types";
import { jsonError } from "./lib/errors";
import { csrf } from "./middleware/csrf";
import { registerAuthRoutes } from "./routes/auth";
import { registerGoogleRoutes } from "./routes/google";

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>().basePath("/api");
  app.use("*", async (c, next) => {
    c.set("deps", deps);
    await next();
  });
  app.use("*", csrf);
  app.get("/health", (c) => c.json({ status: "ok" }));
  registerAuthRoutes(app);
  registerGoogleRoutes(app);
  app.notFound((c) => jsonError(c, 404, "Not Found."));
  app.onError((error, c) => {
    console.error(error);
    return jsonError(c, 500, "Server Error");
  });
  return app;
}
