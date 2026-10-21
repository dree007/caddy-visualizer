import { getI18n } from "@/i18n/server";
import {
  formatBytes,
  formatCount,
  formatMs,
  formatPercent,
} from "@/lib/format";
import type { MetricsTotals } from "@/modules/access-log/queries";

/** KPI row: the headline numbers of the selected range. */
export async function StatTiles({ totals }: { totals: MetricsTotals }) {
  const { locale, t } = await getI18n();
  const m = t.metrics.tiles;
  const tiles = [
    { label: m.requests, value: formatCount(totals.requests, locale) },
    { label: m.traffic, value: formatBytes(totals.bytes, locale) },
    {
      label: m.serverErrors,
      value: formatPercent(totals.byClass["5xx"], totals.requests, locale),
      detail: m.requestCount(formatCount(totals.byClass["5xx"], locale)),
    },
    {
      label: m.avgTime,
      value: formatMs(totals.avgMs, locale),
      detail:
        totals.maxMs === null
          ? undefined
          : m.max(formatMs(totals.maxMs, locale)),
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
          {tile.detail ? (
            <dd className="text-xs text-muted-foreground tabular-nums">
              {tile.detail}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
