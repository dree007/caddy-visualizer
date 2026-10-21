import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import type { Db } from "@/server/db/client";

import { hashPassword, verifyPassword } from "./password";
import { users } from "./schema";
import type { AuthenticatedUser } from "./sessions";

export type CredentialsResult =
  { ok: true; user: AuthenticatedUser } | { ok: false };

export interface CredentialsDeps {
  verify: (hash: string, password: string) => Promise<boolean>;
  /** Hash used for unknown users, so both paths cost one Argon2 computation. */
  dummyHash: () => Promise<string>;
}

let dummyHash: Promise<string> | undefined;

const defaultDeps: CredentialsDeps = {
  verify: verifyPassword,
  dummyHash: () =>
    (dummyHash ??= hashPassword(randomBytes(32).toString("hex"))),
};

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Checks username and password. The result deliberately does not reveal
 * whether the user exists, and unknown users still pay for a hash
 * verification to keep response times similar.
 */
export async function verifyCredentials(
  db: Db,
  input: { username: string; password: string },
  deps: CredentialsDeps = defaultDeps,
): Promise<CredentialsResult> {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.username, normalizeUsername(input.username)))
    .limit(1);

  if (!user) {
    await deps.verify(await deps.dummyHash(), input.password);
    return { ok: false };
  }

  const valid = await deps.verify(user.passwordHash, input.password);
  return valid
    ? { ok: true, user: { id: user.id, username: user.username } }
    : { ok: false };
}
