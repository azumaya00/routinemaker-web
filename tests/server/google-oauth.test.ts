import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { createGoogleOAuth } from "@/server/lib/google";

const opts = { clientId: "client-id", clientSecret: "client-secret", redirectUri: "https://routinemaker.test/api/auth/google/callback" };

function token(claims: Record<string, unknown>) {
  return `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
}

const validClaims = { sub: "google-123", email: "Foo@Example.com", name: "Foo", aud: opts.clientId, iss: "https://accounts.google.com", exp: Math.floor(Date.now() / 1000) + 3600 };

test("認可 URL に OAuth と PKCE の必要な値を付ける", () => {
  const url = createGoogleOAuth(opts).createAuthorizationURL("state-value", "verifier-value");
  expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: "state-value",
    code_challenge: createHash("sha256").update("verifier-value").digest("base64url"),
    code_challenge_method: "S256",
  });
});

test("トークン窓口へ正しいフォームを POST し id_token のプロフィールを返す", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id_token: token(validClaims) }), { status: 200 });
  }) as typeof fetch;
  const profile = await createGoogleOAuth(opts, fetchImpl).validateCallback("auth-code", "verifier-value");
  expect(profile).toEqual({ sub: "google-123", email: "Foo@Example.com", name: "Foo" });
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe("https://oauth2.googleapis.com/token");
  expect(calls[0].init?.method).toBe("POST");
  expect(calls[0].init?.headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });
  expect(Object.fromEntries(new URLSearchParams(calls[0].init?.body as string))).toEqual({
    code: "auth-code", client_id: opts.clientId, client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri, grant_type: "authorization_code", code_verifier: "verifier-value",
  });
});

test.each([
  ["aud 不一致", { aud: "other" }, 200],
  ["iss 不一致", { iss: "https://attacker.test" }, 200],
  ["期限切れ", { exp: Math.floor(Date.now() / 1000) - 1 }, 200],
  ["トークン窓口の失敗", {}, 400],
])("%s は認証失敗として例外を投げる", async (_name, override, status) => {
  const fetchImpl = (async () => new Response(JSON.stringify({ id_token: token({ ...validClaims, ...override }) }), { status })) as typeof fetch;
  await expect(createGoogleOAuth(opts, fetchImpl).validateCallback("code", "verifier"))
    .rejects.toThrow();
});

test("email と name がない id_token は null として返す", async () => {
  const claims = { sub: validClaims.sub, aud: validClaims.aud, iss: validClaims.iss, exp: validClaims.exp };
  const fetchImpl = (async () => new Response(JSON.stringify({ id_token: token(claims) }))) as typeof fetch;
  await expect(createGoogleOAuth(opts, fetchImpl).validateCallback("code", "verifier"))
    .resolves.toEqual({ sub: "google-123", email: null, name: null });
});
