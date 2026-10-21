import "server-only";

import { cookies, headers } from "next/headers";

import {
  type Locale,
  LOCALE_COOKIE,
  type Messages,
  messagesFor,
  resolveLocale,
} from ".";

/** Locale of the current request and its texts (Server Components, Actions). */
export async function getI18n(): Promise<{ locale: Locale; t: Messages }> {
  const [store, head] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale(
    store.get(LOCALE_COOKIE)?.value,
    head.get("accept-language"),
  );
  return { locale, t: messagesFor(locale) };
}
