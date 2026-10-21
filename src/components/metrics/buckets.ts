import type { Locale, Messages } from "@/i18n";
import { formatDate } from "@/lib/format";
import type { Metrics } from "@/modules/access-log/queries";

import type { ChartBucket } from "./requests-chart";

/** Labels in the server's time zone (formatted server-side, like all times). */
export function chartBuckets(
  metrics: Metrics,
  locale: Locale,
  t: Messages,
): ChartBucket[] {
  const hourly = metrics.range === "24h";
  const tickOptions: Intl.DateTimeFormatOptions = hourly
    ? { hour: "2-digit", hourCycle: "h23" }
    : metrics.range === "7d"
      ? { weekday: "short" }
      : { day: "numeric", month: "numeric" };
  const labelOptions: Intl.DateTimeFormatOptions = hourly
    ? {
        day: "numeric",
        month: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }
    : { weekday: "long", day: "numeric", month: "long" };
  const every = hourly ? 6 : metrics.range === "7d" ? 1 : 7;
  const last = metrics.series.length - 1;
  return metrics.series.map((point, index) => {
    const label = formatDate(point.start, locale, labelOptions);
    return {
      key: String(point.start),
      // Hours as bare numbers ("14"); the axis has no room for "14 Uhr".
      tick:
        (last - index) % every === 0
          ? hourly
            ? formatDate(point.start, "en", tickOptions)
            : formatDate(point.start, locale, tickOptions)
          : "",
      label: hourly ? t.metrics.chart.hourLabel(label) : label,
      requests: point.requests,
      errors: point.errors,
    };
  });
}
