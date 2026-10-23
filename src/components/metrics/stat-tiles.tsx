import { getI18n } from "@/i18n/server";
import {
  formatBytes,
  formatCount,
  formatMs,
  formatPercent,
} from "@/lib/format";
import type { Metrics } from "@/modules/access-log/queries";
import { rateOf, type Trend, trendOf } from "@/modules/access-log/trends";

import { type Polarity, TrendBadge } from "./trend";

/** KPI row: the headline numbers of the selected range, each with its trend. */
export async function StatTiles({
  metrics,
}: {
  metrics: Pick<Metrics, "range" | "totals" | "previous">;
}) {
  const { locale, t } = await getI18n();
  const m = t.metrics.tiles;
  const { totals, range } = metrics;
  const before = metrics.previous.totals;
  // Without traffic before (e.g. a new installation) there is nothing to compare.
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
      // Change of the error rate, so more traffic alone does not look worse.
      trend: versus(
        rateOf(totals.byClass["5xx"], totals.requests),
        rateOf(before.byClass["5xx"], before.requests),
      ),
      polarity: "lower-is-better",
    },
    {
      label: m.avgTime,
      value: formatMs(totals.avgMs, locale),
      detail:
        totals.maxMs === null
          ? undefined
          : m.max(formatMs(totals.maxMs, locale)),
      trend: versus(totals.avgMs, before.avgMs),
      polarity: "lower-is-better",
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="surface-band flex min-w-0 flex-col gap-2 p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.6)] md:p-6 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
        >
          <dt className="eyebrow">{tile.label}</dt>
          <dd className="font-display text-[2rem] leading-none font-light tracking-[-0.02em] tabular-nums md:text-[2.5rem]">
            {tile.value}
          </dd>
          <dd className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground tabular-nums">
            <TrendBadge
              trend={tile.trend}
              polarity={tile.polarity}
              range={range}
              locale={locale}
              t={t}
              showPeriod
            />
            {tile.detail ? <span>{tile.detail}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
