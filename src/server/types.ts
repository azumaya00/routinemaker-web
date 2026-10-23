import type { Db } from "./db/client";
import type { UserRow } from "./db/schema";

export type Mailer = {
  send(msg: { to: string; subject: string; text: string; html: string }): Promise<void>;
};
export type GoogleProfile = { sub: string; email: string | null; name: string | null };
export type GoogleOAuth = {
  createAuthorizationURL(state: string, codeVerifier: string): URL;
  validateCallback(code: string, codeVerifier: string): Promise<GoogleProfile>;
};
export type AppDeps = {
  db: Db;
  mailer: Mailer;
  google: GoogleOAuth;
  appUrl: string;
  now?: () => Date;
};
export type AppEnv = { Variables: { user: UserRow; sessionToken: string } };
