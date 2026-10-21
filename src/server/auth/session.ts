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

/** Use in every protected page, layout and Server Action. */
export async function requireSession(): Promise<ValidatedSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}
