import type { Locale } from "./locales";
import { de } from "./messages/de";
import { en, type Messages } from "./messages/en";

export type { Messages };
export * from "./locales";
export { code, translateCode, type CodeKey } from "./codes";

const MESSAGES: Record<Locale, Messages> = { en, de };

export function messagesFor(locale: Locale): Messages {
  return MESSAGES[locale];
}
