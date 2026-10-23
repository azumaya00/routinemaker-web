import { describe, expect, test } from "vitest";
import { Hono } from "hono";
import { jsonError, validationError, validationMessage } from "@/server/lib/errors";

const app = new Hono();
app.get("/validation", (c) => validationError(c, JSON.parse(c.req.query("errors") ?? "{}")));
app.get("/error", (c) => jsonError(c, 403, "Forbidden."));

describe("validationError", () => {
  test.each([
    [{ email: ["The email field is required."] }, "The email field is required."],
    [{ email: ["The email field is required."], name: ["The name field is required."] }, "The email field is required. (and 1 more error)"],
    [{ password: ["first", "second"], email: ["third"] }, "first (and 2 more errors)"],
  ])("エラー件数に応じた message を返す", async (errors, message) => {
    const res = await app.request(`/validation?errors=${encodeURIComponent(JSON.stringify(errors))}`);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ message, errors });
  });
});

test("jsonError は指定された status と message を返す", async () => {
  const res = await app.request("/error");
  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({ message: "Forbidden." });
});

test.each([
  ["required", "dark_mode", "The dark mode field is required."],
  ["string", "title", "The title field must be a string."],
  ["email", "email", "The email field must be a valid email address."],
  ["max:255", "title", "The title field must not be greater than 255 characters."],
  ["array", "tasks", "The tasks field must be an array."],
  ["in", "dark_mode", "The selected dark mode is invalid."],
  ["boolean", "show_celebration", "The show celebration field must be true or false."],
  ["required", "tasks.0", "The tasks.0 field is required."],
] as const)("%s の文言は Laravel 形式", (rule, field, expected) => {
  expect(validationMessage(rule, field)).toBe(expected);
});
