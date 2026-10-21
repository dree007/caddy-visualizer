"use client";

import { createContext, type ReactNode, useContext } from "react";

import { DEFAULT_LOCALE, type Locale, type Messages, messagesFor } from ".";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Only the locale crosses to the client; the texts are bundled here. */
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useI18n(): { locale: Locale; t: Messages } {
  const locale = useContext(LocaleContext);
  return { locale, t: messagesFor(locale) };
}
