import { expect, test } from "vitest";
import { createTestContext } from "./helpers";

test("GET /api/health は status ok を返す", async () => {
  const { app } = await createTestContext();
  const res = await app.request("/api/health");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});

test("存在しない /api のパスは 404", async () => {
  const { app } = await createTestContext();
  const res = await app.request("/api/nope");
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ message: "Not Found." });
});
