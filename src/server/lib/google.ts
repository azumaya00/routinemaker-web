import { createHash } from "node:crypto";
import type { GoogleOAuth, GoogleProfile } from "../types";

type GoogleOptions = {
  clientId: string;
  clientSecret: string;
  redirectUri: string
};

export function createGoogleOAuth(
  opts: GoogleOptions,
  fetchImpl: typeof fetch = fetch,
): GoogleOAuth {
  return {
    createAuthorizationURL(state, codeVerifier) {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: opts.clientId,
        redirect_uri: opts.redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        code_challenge: createHash("sha256").update(codeVerifier).digest("base64url"),
        code_challenge_method: "S256",
      }).toString();
      return url;
    },
    async validateCallback(code, codeVerifier): Promise<GoogleProfile> {
      const form = new URLSearchParams({
        code,
        client_id: opts.clientId,
        client_secret: opts.clientSecret,
        redirect_uri: opts.redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      });
      const response = await fetchImpl("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      if (!response.ok) {
        throw new Error("Google token exchange failed");
      }
      const body: unknown = await response.json();
      if (
        !body || typeof body !== "object" || !("id_token" in body) ||
        typeof body.id_token !== "string"
      ) {
        throw new Error("Google id_token missing");
      }
      const parts = body.id_token.split(".");
      if (parts.length !== 3) {
        throw new Error("Google id_token malformed");
      }
      const claims: unknown = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      if (!claims || typeof claims !== "object") {
        throw new Error("Google claims malformed");
      }
      const value = claims as Record<string, unknown>;
      // トークンは Google の TLS エンドポイントから直接受け取るが、各クレームでこのクライアントと有効期限も確かめる。
      if (value.aud !== opts.clientId ||
        !["https://accounts.google.com", "accounts.google.com"].includes(String(value.iss))
        || typeof value.exp !== "number" || value.exp <= Math.floor(Date.now() / 1000)
        || typeof value.sub !== "string" || !value.sub) {
        throw new Error("Google id_token invalid");
      }
      return {
        sub: value.sub,
        email: typeof value.email === "string" ? value.email : null,
        name: typeof value.name === "string" ? value.name : null,
      };
    },
  };
}
