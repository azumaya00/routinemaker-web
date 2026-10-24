import { handle } from "hono/vercel";
import { createApp } from "@/server/app";
import { createNeonDb } from "@/server/db/client";
import { createSmtpMailer } from "@/server/lib/mail";
import { createGoogleOAuth } from "@/server/lib/google";
import { toStandardRequest } from "@/server/lib/standard-request";

export const runtime = "nodejs";

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function createHandler() {
  const app = createApp({
    db: createNeonDb(env("DATABASE_URL")),
    mailer: createSmtpMailer({
      host: env("MAIL_HOST"),
      port: Number(env("MAIL_PORT")),
      user: env("MAIL_USERNAME"),
      pass: env("MAIL_PASSWORD"),
      from: env("MAIL_FROM_ADDRESS")
    }),
    google: createGoogleOAuth({
      clientId: env("GOOGLE_CLIENT_ID"),
      clientSecret: env("GOOGLE_CLIENT_SECRET"),
      redirectUri: env("GOOGLE_REDIRECT_URI")
    }),
    appUrl: env("APP_URL"),
  });
  return handle(app);
}

function serve(request: Request) {
  return createHandler()(toStandardRequest(request));
}

export const GET = serve;

export const POST = serve;

export const PATCH = serve;

export const DELETE = serve;
