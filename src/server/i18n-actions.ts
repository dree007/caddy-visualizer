"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { isLocale, LOCALE_COOKIE } from "@/i18n";
import { secureCookiesEnabled } from "@/server/auth/cookie";

/** Stores the chosen language; works with and without a session (login page). */
export async function setLocaleAction(locale: unknown): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 365 * 24 * 3600,
    sameSite: "lax",
    httpOnly: true,
    secure: secureCookiesEnabled(),
  });
  revalidatePath("/", "layout");
}
