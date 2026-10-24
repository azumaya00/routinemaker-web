import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { deleteCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import type { Db } from "../db/client";
import { sessions, users, type UserRow } from "../db/schema";

export const SESSION_COOKIE = "rm_session";

export const SESSION_LIFETIME_MINUTES = 120;

const lifetimeMs = SESSION_LIFETIME_MINUTES * 60_000;

function sessionId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(db: Db, userId: number, now: Date): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    id: sessionId(token),
    userId,
    expiresAt: new Date(now.getTime() + lifetimeMs),
    createdAt: now,
  });
  return token;
}

export async function validateSession(db: Db, token: string, now: Date): Promise<{
  user: UserRow;
  extended: boolean
} | null> {
  const [match] = await db.select({
    user: users,
    session: sessions
  })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(
      eq(sessions.id, sessionId(token)),
      gt(sessions.expiresAt, now),
      isNull(users.deletedAt),
    ))
    .limit(1);
  if (!match) {
    return null;
  }
  const extended = match.session.expiresAt.getTime() - now.getTime() < lifetimeMs / 2;
  if (extended) {
    await db.update(sessions).set({ expiresAt: new Date(now.getTime() + lifetimeMs) })
      .where(eq(sessions.id, match.session.id));
  }
  return {
    user: match.user,
    extended
  };
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId(token)));
}

export async function deleteUserSessions(db: Db, userId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_LIFETIME_MINUTES * 60,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, {
    path: "/",
    secure: true,
    sameSite: "Lax",
    httpOnly: true
  });
}
