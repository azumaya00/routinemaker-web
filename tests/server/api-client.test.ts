import { afterEach, expect, test, vi } from "vitest";
import { apiRequest, getCsrfCookie, login, logout, register } from "@/lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("認証リクエストを同じドメインの API パスへ送る", async () => {
  const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
    void args;
    return new Response(null, { status: 204 });
  });
  vi.stubGlobal("fetch", fetchMock);

  await login("user@example.com", "password123");
  await register("user@example.com", "password123", "password123");
  await logout();

  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "/api/login",
    "/api/register",
    "/api/logout",
  ]);
});

test("Cookie 準備の互換関数と旧オプションは追加通信やヘッダーを生まない", async () => {
  const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
    void args;
    return new Response(null, { status: 204 });
  });
  vi.stubGlobal("fetch", fetchMock);

  expect(await getCsrfCookie()).toEqual({ status: 204, headers: {}, body: "" });
  await apiRequest("/api/logout", { method: "POST" }, { includeXsrfHeader: true });

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [, options] = fetchMock.mock.calls[0];
  expect(new Headers(options?.headers).has("X-XSRF-TOKEN")).toBe(false);
});
