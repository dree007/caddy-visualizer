import { randomUUID } from "node:crypto";

import { eq, lt } from "drizzle-orm";

import type { Db } from "@/server/db/client";

import { type Session, sessions, users } from "./schema";
import {
  generateSessionToken,
  hashSessionToken,
  SESSION_TOKEN_PATTERN,
} from "./tokens";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Sessions expire after 30 days without activity. */
export const SESSION_TTL_MS = 30 * DAY_MS;
/** Active sessions are extended once less than half of their lifetime remains. */
export const SESSION_RENEW_THRESHOLD_MS = 15 * DAY_MS;
/** `last_seen_at` is only written when it is older than this, to avoid a write per request. */
const LAST_SEEN_RESOLUTION_MS = 60 * 1000;

export interface AuthenticatedUser {
  id: string;
  username: string;
}

export interface ValidatedSession {
  session: Session;
  user: AuthenticatedUser;
}

export async function createSession(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<{ token: string; session: Session }> {
  const token = generateSessionToken();
  const session: Session = {
    id: randomUUID(),
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    createdAt: now,
    lastSeenAt: now,
  };
  await db.insert(sessions).values(session);
  return { token, session };
}

/**
 * Resolves a session token to its session and user. Expired sessions are
 * deleted and reported as missing; active sessions are extended (sliding expiry).
 */
export async function validateSessionToken(
  db: Db,
  token: string,
  now: Date = new Date(),
): Promise<ValidatedSession | null> {
  if (!SESSION_TOKEN_PATTERN.test(token)) return null;

  const [row] = await db
    .select({
      session: sessions,
      user: { id: users.id, username: users.username },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, hashSessionToken(token)))
    .limit(1);
  if (!row) return null;

  const { session, user } = row;
  if (session.expiresAt.getTime() <= now.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }

  if (
    session.expiresAt.getTime() - now.getTime() <
    SESSION_RENEW_THRESHOLD_MS
  ) {
    session.expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    session.lastSeenAt = now;
    await db
      .update(sessions)
      .set({ expiresAt: session.expiresAt, lastSeenAt: now })
      .where(eq(sessions.id, session.id));
  } else if (
    now.getTime() - session.lastSeenAt.getTime() >=
    LAST_SEEN_RESOLUTION_MS
  ) {
    session.lastSeenAt = now;
    await db
      .update(sessions)
      .set({ lastSeenAt: now })
      .where(eq(sessions.id, session.id));
  }

  return { session, user };
}

export async function invalidateSessionToken(
  db: Db,
  token: string,
): Promise<void> {
  if (!SESSION_TOKEN_PATTERN.test(token)) return;
  await db
    .delete(sessions)
    .where(eq(sessions.tokenHash, hashSessionToken(token)));
}

export async function invalidateUserSessions(
  db: Db,
  userId: string,
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function deleteExpiredSessions(
  db: Db,
  now: Date = new Date(),
): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
}
