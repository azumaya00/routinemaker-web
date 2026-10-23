import { expect, test } from "vitest";
import { hashPassword, verifyPassword } from "@/server/lib/password";

test("bcryptjs で作ったハッシュを照合できる", async () => {
  const hash = await hashPassword("secret123");
  expect(hash).toMatch(/^\$2[ab]\$12\$/);
  expect(await verifyPassword("secret123", hash)).toBe(true);
  expect(await verifyPassword("wrong", hash)).toBe(false);
});

test("Laravel の $2y$ ハッシュで正しいパスワードだけ通る", async () => {
  const hash = "$2y$12$Kds.ao75naP5GZHzNdMjZeNpfMYoF2kBkDixamMw9l.LEl3jEVzfC";
  expect(await verifyPassword("secret123", hash)).toBe(true);
  expect(await verifyPassword("wrong", hash)).toBe(false);
});

test("hash が null なら照合しない", async () => {
  expect(await verifyPassword("secret123", null)).toBe(false);
});
