import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import {
  validateSessionToken,
  type ValidatedSession,
} from "@/modules/auth/sessions";
import { getDb } from "@/server/db";

import { sessionCookieName } from "./cookie";
import { authDisabled } from "./mode";

/**
 * Data access layer for authentication. This is the authoritative check:
 * `proxy.ts` only performs an optimistic cookie check.
 * Cached per request, so layout and page share one lookup.
 */
export const getCurrentSession = cache(
  async (): Promise<ValidatedSession | null> => {
    const token = (await cookies()).get(sessionCookieName())?.value;
    if (!token) return null;
    return validateSessionToken(getDb(), token);
  },
);

export type Access =
  | { mode: "session"; user: ValidatedSession["user"] }
  /** Built-in login disabled: the reverse proxy authenticated the request. */
  | { mode: "proxy" };

/**
 * Use in every protected page, layout and Server Action. With the built-in
 * login disabled no session is read at all, so an old cookie means nothing.
 */
export async function requireAccess(): Promise<Access> {
  if (authDisabled()) return { mode: "proxy" };
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return { mode: "session", user: session.user };
}
