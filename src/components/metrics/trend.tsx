import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import type { Locale, Messages } from "@/i18n";
import { formatChange } from "@/lib/format";
import type { Range } from "@/modules/access-log/queries";
import type { Trend } from "@/modules/access-log/trends";

/**
 * - `neutral`: more or less is neither good nor bad (requests, traffic)
 * - `lower-is-better`: a rise is bad (errors, response time)
 */
export type Polarity = "neutral" | "lower-is-better";

/** Below this change the arrow points sideways. */
const FLAT = 0.005;

const TONES = {
  good: "text-(--viz-good)",
  bad: "text-(--viz-critical)",
  neutral: "text-muted-foreground",
} as const;

/** Arrow and signed percentage against the previous period; nothing without one. */
export function TrendBadge({
  trend,
  polarity,
  range,
  locale,
  t,
  showPeriod = false,
}: {
  trend: Trend;
  polarity: Polarity;
  range: Range;
  locale: Locale;
  t: Messages;
  /** Writes "vs. previous 24 h" next to it (otherwise only for screen readers). */
  showPeriod?: boolean;
}) {
  if (trend.kind === "none") return null;
  const direction =
    trend.kind === "new" || trend.ratio >= FLAT
      ? "up"
      : trend.ratio <= -FLAT
        ? "down"
        : "flat";
  const tone =
    polarity === "neutral" || direction === "flat"
      ? "neutral"
      : direction === "up"
        ? "bad"
        : "good";
  const Icon =
    direction === "up"
      ? ArrowUpRight
      : direction === "down"
        ? ArrowDownRight
        : ArrowRight;
  const text =
    trend.kind === "new"
      ? t.metrics.trend.new
      : formatChange(trend.ratio, locale);
  const period = t.metrics.trend.versus[range];

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 text-xs tabular-nums">
      <span
        className={`inline-flex items-center gap-0.5 font-medium whitespace-nowrap ${TONES[tone]}`}
      >
        <Icon aria-hidden className="size-3.5" strokeWidth={2} />
        {text}
      </span>
      <span className={showPeriod ? "text-muted-foreground" : "sr-only"}>
        {period}
      </span>
    </span>
  );
}
