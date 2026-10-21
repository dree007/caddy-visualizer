import { randomUUID } from "node:crypto";

import { count, eq } from "drizzle-orm";

import type { Db } from "@/server/db/client";

import { normalizeUsername } from "./credentials";
import { hashPassword } from "./password";
import { users } from "./schema";
import { invalidateUserSessions } from "./sessions";

export interface AdminBootstrapInput {
  username: string;
  /** Only required when no admin exists yet or when resetting the password. */
  password?: string;
  resetPassword?: boolean;
}

export type AdminBootstrapResult =
  | { status: "created"; username: string }
  | { status: "password-reset"; username: string }
  | { status: "unchanged"; username: string }
  | { status: "username-mismatch"; configured: string; existing: string[] };

export class AdminBootstrapError extends Error {
  override name = "AdminBootstrapError";
}

/**
 * Idempotent start-up initialization of the single admin account:
 * - no user yet → create the admin from the configured username and password
 * - admin exists → never touch it, unless a password reset is requested explicitly
 */
export async function ensureInitialAdmin(
  db: Db,
  input: AdminBootstrapInput,
  hash: (password: string) => Promise<string> = hashPassword,
  now: Date = new Date(),
): Promise<AdminBootstrapResult> {
  const username = normalizeUsername(input.username);
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existing) {
    if (!input.resetPassword) return { status: "unchanged", username };
    if (!input.password) {
      throw new AdminBootstrapError(
        "ADMIN_RESET_PASSWORD is set, but no ADMIN_INITIAL_PASSWORD or ADMIN_INITIAL_PASSWORD_FILE is configured.",
      );
    }
    await db
      .update(users)
      .set({ passwordHash: await hash(input.password), updatedAt: now })
      .where(eq(users.id, existing.id));
    await invalidateUserSessions(db, existing.id);
    return { status: "password-reset", username };
  }

  const [{ total } = { total: 0 }] = await db
    .select({ total: count() })
    .from(users);
  if (total > 0) {
    const others = await db.select({ username: users.username }).from(users);
    return {
      status: "username-mismatch",
      configured: username,
      existing: others.map((u) => u.username),
    };
  }

  if (!input.password) {
    throw new AdminBootstrapError(
      "No admin account exists yet. Set ADMIN_INITIAL_PASSWORD_FILE (recommended) or ADMIN_INITIAL_PASSWORD for the first start.",
    );
  }

  await db.insert(users).values({
    id: randomUUID(),
    username,
    passwordHash: await hash(input.password),
    createdAt: now,
    updatedAt: now,
  });
  return { status: "created", username };
}
