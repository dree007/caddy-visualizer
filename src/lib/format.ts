import { INTL_LOCALE, type Locale } from "@/i18n/locales";

// Server time zone (TZ of the container): times are formatted server-side.
const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();

function dateFormat(
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `d${locale}${JSON.stringify(options)}`;
  let format = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!format) {
    format = new Intl.DateTimeFormat(INTL_LOCALE[locale], options);
    cache.set(key, format);
  }
  return format;
}

function numberFormat(
  locale: Locale,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `n${locale}${JSON.stringify(options)}`;
  let format = cache.get(key) as Intl.NumberFormat | undefined;
  if (!format) {
    format = new Intl.NumberFormat(INTL_LOCALE[locale], options);
    cache.set(key, format);
  }
  return format;
}

export function formatDateTime(date: Date | number, locale: Locale): string {
  return dateFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}

/** Day, month and time to the second, for log lines. */
export function formatLogTime(date: Date | number, locale: Locale): string {
  return dateFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatDate(
  date: Date | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
): string {
  return dateFormat(locale, options).format(date);
}

/** 1,284 · 12,900 · 4.2M (en) / 1.284 · 12.900 · 4,2 Mio. (de) */
export function formatCount(value: number, locale: Locale): string {
  return value < 1_000_000
    ? numberFormat(locale, {}).format(value)
    : numberFormat(locale, {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
}

export function formatBytes(value: number, locale: Locale): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  const digits = unit === 0 || size >= 100 ? 0 : 1;
  return `${numberFormat(locale, { maximumFractionDigits: digits }).format(size)} ${units[unit]}`;
}

export function formatMs(value: number | null, locale: Locale): string {
  if (value === null) return "–";
  if (value >= 1000) {
    return `${numberFormat(locale, { maximumFractionDigits: 1 }).format(value / 1000)} s`;
  }
  return `${numberFormat(locale, { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value)} ms`;
}

export function formatPercent(
  part: number,
  total: number,
  locale: Locale,
): string {
  if (total === 0) return "–";
  const value = (part / total) * 100;
  return `${numberFormat(locale, { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value)} %`;
}
