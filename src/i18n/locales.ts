export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "cv_locale";

/** BCP 47 tags for Intl formatting (24-hour clock in both). */
export const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", de: "de-DE" };

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Cookie first, then the browser's preferred languages, then English. */
export function resolveLocale(
  cookie: string | undefined | null,
  acceptLanguage: string | undefined | null,
): Locale {
  if (isLocale(cookie)) return cookie;
  for (const part of (acceptLanguage ?? "").split(",")) {
    const language = part.trim().split(";")[0]?.split("-")[0]?.toLowerCase();
    if (isLocale(language)) return language;
  }
  return DEFAULT_LOCALE;
}
