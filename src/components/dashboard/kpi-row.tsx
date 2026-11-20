import type { Locale, Messages } from "@/i18n";
import {
  formatBytes,
  formatCount,
  formatMs,
  formatPercent,
} from "@/lib/format";
import type { Metrics } from "@/modules/access-log/queries";
import { rateOf, type Trend, trendOf } from "@/modules/access-log/trends";
import { type Polarity, TrendBadge } from "@/components/metrics/trend";

/** The headline numbers as one ruled row (no cards), each with its trend. */
export function KpiRow({
  metrics,
  locale,
  t,
}: {
  metrics: Pick<Metrics, "range" | "totals" | "previous">;
  locale: Locale;
  t: Messages;
}) {
  const m = t.metrics.tiles;
  const { totals, range } = metrics;
  const before = metrics.previous.totals;
  const versus = (current: number | null, previous: number | null): Trend =>
    before.requests > 0 ? trendOf(current, previous) : { kind: "none" };
  const tiles: {
    label: string;
    value: string;
    detail?: string;
    trend: Trend;
    polarity: Polarity;
  }[] = [
    {
      label: m.requests,
      value: formatCount(totals.requests, locale),
      trend: versus(totals.requests, before.requests),
      polarity: "neutral",
    },
    {
      label: m.traffic,
      value: formatBytes(totals.bytes, locale),
      trend: versus(totals.bytes, before.bytes),
      polarity: "neutral",
    },
    {
      label: m.serverErrors,
      value: formatPercent(totals.byClass["5xx"], totals.requests, locale),
      detail: m.requestCount(formatCount(totals.byClass["5xx"], locale)),
      trend: versus(
        rateOf(totals.byClass["5xx"], totals.requests),
        rateOf(before.byClass["5xx"], before.requests),
      ),
      polarity: "lower-is-better",
    },
    {
      label: m.avgTime,
      value: formatMs(totals.avgMs, locale),
      trend: versus(totals.avgMs, before.avgMs),
      polarity: "lower-is-better",
    },
  ];
  return (
    <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] border-y border-t-2 border-b border-t-foreground border-b-border tabular-nums">
      {tiles.map((tile, i) => (
        <div
          key={tile.label}
          className={`flex min-w-0 flex-col py-4 ${i === 0 ? "pr-5" : "px-5"} ${i < tiles.length - 1 ? "border-r border-border" : ""}`}
        >
          <dt className="text-sm text-muted-foreground">{tile.label}</dt>
          <dd className="m-0 mt-0.5 flex flex-wrap items-baseline gap-x-2 font-display text-[2rem] leading-tight font-semibold tracking-[-0.02em]">
            {tile.value}
            <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendBadge
                trend={tile.trend}
                polarity={tile.polarity}
                range={range}
                locale={locale}
                t={t}
              />
              {tile.detail}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
