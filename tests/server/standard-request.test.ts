import { NextRequest } from "next/server";
import { expect, test } from "vitest";
import { routines } from "@/server/db/schema";
import { hashPassword } from "@/server/lib/password";
import { toStandardRequest } from "@/server/lib/standard-request";
import { createTestContext, loginAs } from "./helpers";

const origin = "https://routinemaker.test";

test("Content-Length のない空の NextRequest を変換するとルーティンを開始できる", async () => {
  const ctx = await createTestContext();
  const { user, cookie } = await loginAs(ctx, {});
  const [routine] = await ctx.db.insert(routines).values({ userId: user.id, title: "Morning", tasks: ["Wash"] }).returning();
  const request = new NextRequest(`${origin}/api/routines/${routine.id}/start`, {
    method: "POST",
    headers: { Origin: origin, Cookie: cookie },
    body: new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } }),
    duplex: "half",
  });

  expect(request.headers.has("content-length")).toBe(false);
  const standard = toStandardRequest(request);
  expect(standard).toBeInstanceOf(Request);
  expect(standard).not.toBeInstanceOf(NextRequest);
  const response = await ctx.app.request(standard);
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ data: { routine_id: routine.id, title: "Morning" } });
});

test("本文のある NextRequest を変換してもログインの JSON を読める", async () => {
  const ctx = await createTestContext();
  await loginAs(ctx, { email: "member@example.test", password: await hashPassword("password123") });
  const payload = new TextEncoder().encode(JSON.stringify({ email: "member@example.test", password: "password123" }));
  const request = new NextRequest(`${origin}/api/login`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(payload); controller.close(); } }),
    duplex: "half",
  });

  const response = await ctx.app.request(toStandardRequest(request));
  expect(response.status).toBe(204);
  expect(response.headers.get("set-cookie")).toMatch(/^rm_session=/);
});

test("GET の NextRequest を変換してもヘルスチェックに渡せる", async () => {
  const { app } = await createTestContext();
  const request = new NextRequest(`${origin}/api/health`);
  const response = await app.request(toStandardRequest(request));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
