"use client";

import { useTransition } from "react";

import { useI18n } from "@/i18n/client";
import { LOCALES } from "@/i18n/locales";
import { setLocaleAction } from "@/server/i18n-actions";

/** The account menu is not available before login. */
export function LanguageSwitch() {
  const { locale, t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <nav
      aria-label={t.account.language}
      className="surface-pressed mx-auto mt-8 flex w-fit gap-0.5 p-1 text-sm"
    >
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          disabled={pending}
          aria-current={option === locale ? "true" : undefined}
          onClick={() => start(() => setLocaleAction(option))}
          className="min-h-10 rounded-full px-4 font-medium text-muted-foreground transition-[color,background-color,box-shadow] duration-200 hover:text-foreground aria-[current=true]:bg-card aria-[current=true]:text-foreground aria-[current=true]:shadow-soft-sm md:min-h-8"
        >
          {t.languages[option]}
        </button>
      ))}
    </nav>
  );
}
