import { Hono } from "hono";
import type { AppDeps, AppEnv } from "./types";
import { jsonError } from "./lib/errors";

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>().basePath("/api");
  void deps;
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.notFound((c) => jsonError(c, 404, "Not Found."));
  app.onError((error, c) => {
    console.error(error);
    return jsonError(c, 500, "Server Error");
  });
  return app;
}
