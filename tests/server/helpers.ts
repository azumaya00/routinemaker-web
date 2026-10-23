import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createApp } from "@/server/app";
import * as schema from "@/server/db/schema";
import { createSession, SESSION_COOKIE } from "@/server/lib/session";
import type { AppDeps, GoogleOAuth, GoogleProfile, Mailer } from "@/server/types";
import type { UserRow } from "@/server/db/schema";

export class FakeMailer implements Mailer {
  sent: Parameters<Mailer["send"]>[0][] = [];

  async send(msg: Parameters<Mailer["send"]>[0]) {
    this.sent.push(msg);
  }
}

export class FakeGoogle implements GoogleOAuth {
  nextProfile: GoogleProfile = { sub: "google-test-id", email: "test@example.com", name: "Test User" };
  nextError: Error | null = null;

  createAuthorizationURL(state: string, codeVerifier: string): URL {
    const url = new URL("https://accounts.google.test/authorize");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeVerifier);
    return url;
  }

  async validateCallback(): Promise<GoogleProfile> {
    if (this.nextError) throw this.nextError;
    return this.nextProfile;
  }
}

export async function createTestContext() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  const mailer = new FakeMailer();
  const google = new FakeGoogle();
  const now = { value: new Date("2026-10-23T00:00:00.000Z") };
  const deps: AppDeps = { db, mailer, google, appUrl: "https://routinemaker.test", now: () => now.value };
  const app = createApp(deps);
  return { app, db, mailer, google, now, deps };
}

export async function loginAs(ctx: Awaited<ReturnType<typeof createTestContext>>, user: Partial<UserRow>): Promise<{ user: UserRow; cookie: string }> {
  const [created] = await ctx.db.insert(schema.users).values({
    name: user.name ?? "Test User",
    email: user.email ?? `user-${crypto.randomUUID()}@example.test`,
    ...user,
  }).returning();
  const token = await createSession(ctx.db, created.id, ctx.now.value);
  return { user: created, cookie: `${SESSION_COOKIE}=${token}` };
}
