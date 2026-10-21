"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  normalizeUsername,
  verifyCredentials,
} from "@/modules/auth/credentials";
import { LoginThrottle } from "@/modules/auth/login-throttle";
import { createSession, invalidateSessionToken } from "@/modules/auth/sessions";
import { getI18n } from "@/i18n/server";
import { getDb } from "@/server/db";

import { clientIpFrom } from "./client-ip";
import { sessionCookieName, sessionCookieOptions } from "./cookie";
import { safeRedirectPath } from "./redirect";

export interface LoginState {
  error?: string;
  username?: string;
}

const loginSchema = z.object({
  username: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(1024),
  next: z.string().max(2048).optional(),
});

const globalForThrottle = globalThis as unknown as {
  loginThrottle?: LoginThrottle;
  accountThrottle?: LoginThrottle;
};
const throttle = (globalForThrottle.loginThrottle ??= new LoginThrottle());
// Without a proxy in front, clients control X-Forwarded-For; this bound holds anyway.
const accountThrottle = (globalForThrottle.accountThrottle ??=
  new LoginThrottle({ maxFailures: 20 }));

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const { t } = await getI18n();
  const rawUsername = formData.get("username");
  const username =
    typeof rawUsername === "string" ? rawUsername.slice(0, 128) : "";
  const parsed = loginSchema.safeParse({
    username: rawUsername,
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: t.login.missing, username };

  const ip = clientIpFrom(await headers());
  const account = normalizeUsername(parsed.data.username);
  if (throttle.isBlocked(ip) || accountThrottle.isBlocked(account))
    return { error: t.login.throttled, username };

  const db = getDb();
  const result = await verifyCredentials(db, parsed.data);
  if (!result.ok) {
    throttle.recordFailure(ip);
    accountThrottle.recordFailure(account);
    return { error: t.login.invalid, username };
  }
  throttle.reset(ip);

  const { token } = await createSession(db, result.user.id);
  (await cookies()).set(sessionCookieName(), token, sessionCookieOptions());
  redirect(safeRedirectPath(parsed.data.next));
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const name = sessionCookieName();
  const token = store.get(name)?.value;
  if (token) await invalidateSessionToken(getDb(), token);
  store.set(name, "", { ...sessionCookieOptions(), maxAge: 0 });
  redirect("/login");
}
