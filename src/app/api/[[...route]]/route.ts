import { handle } from "hono/vercel";
import { createApp } from "@/server/app";
import { createNeonDb } from "@/server/db/client";
import { createSmtpMailer } from "@/server/lib/mail";
import type { GoogleOAuth } from "@/server/types";

export const runtime = "nodejs";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function createGoogle(): GoogleOAuth {
  env("GOOGLE_CLIENT_ID");
  env("GOOGLE_CLIENT_SECRET");
  env("GOOGLE_REDIRECT_URI");
  return {
    createAuthorizationURL: () => { throw new Error("Google OAuth is not implemented yet"); },
    validateCallback: async () => { throw new Error("Google OAuth is not implemented yet"); },
  };
}

function createHandler() {
  const app = createApp({
    db: createNeonDb(env("DATABASE_URL")),
    mailer: createSmtpMailer({ host: env("MAIL_HOST"), port: Number(env("MAIL_PORT")), user: env("MAIL_USERNAME"), pass: env("MAIL_PASSWORD"), from: env("MAIL_FROM_ADDRESS") }),
    google: createGoogle(),
    appUrl: env("APP_URL"),
  });
  return handle(app);
}

function serve(request: Request) {
  return createHandler()(request);
}

export const GET = serve;
export const POST = serve;
export const PATCH = serve;
export const DELETE = serve;
