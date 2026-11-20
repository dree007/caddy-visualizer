import { STATUS_CODES } from "node:http";

import { getI18n } from "@/i18n/server";
import { formatCount, formatPercent } from "@/lib/format";
import {
  classOf,
  type Metrics,
  STATUS_CLASSES,
} from "@/modules/access-log/queries";

import { trendOf } from "@/modules/access-log/trends";

import { MiniColumns } from "./mini-columns";
import { TrendBadge } from "./trend";
import { STATUS, StatusBreakdown } from "./status-breakdown";

/** Codes shown as cards; the rest are only in the table. */
const CARD_LIMIT = 8;

/**
 * Status codes in three steps: the split of the whole range, each class over
 * time (small multiples, own scales), and the individual codes.
 */
export async function StatusCodes({
  metrics,
  labels,
}: {
  metrics: Metrics;
  /** Tooltip label per series bucket. */
  labels: string[];
}) {
  const { locale, t } = await getI18n();
  const s = t.metrics.status;
  const count = (n: number) => formatCount(n, locale);
  const total = metrics.totals.requests;
  const peak = (values: number[]) => Math.max(0, ...values);
  // The most frequent codes as cards; cards and table in ascending order.
  const byCode = (a: { status: number }, b: { status: number }) =>
    a.status - b.status;
  const cards = metrics.codes.slice(0, CARD_LIMIT).sort(byCode);
  const codes = [...metrics.codes].sort(byCode);
  const hidden = metrics.codes.length - cards.length;

  return (
    <section aria-labelledby="status-heading" className="flex flex-col gap-4">
      <div className="mt-4 flex flex-col gap-1">
        <h2 id="status-heading" className="heading">
          {s.heading}
        </h2>
        <p className="text-sm text-muted-foreground">{s.intro}</p>
      </div>

      <StatusBreakdown totals={metrics.totals} />
      {total === 0 ? null : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-2">
            <h3 className="heading">{s.classesHeading}</h3>
            <p className="text-xs text-muted-foreground">{s.classesNote}</p>
          </div>
          <ul className="surface divide-y divide-border">
            {STATUS_CLASSES.map((c) => {
              const values = metrics.series.map((point) => point.byClass[c]);
              const Icon = STATUS[c].icon;
              const name = `${c} · ${s[c]}`;
              return (
                <li
                  key={c}
                  className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3.5 md:px-5"
                >
                  <span className="flex w-44 min-w-0 items-center gap-2 text-sm">
                    <Icon
                      aria-hidden
                      className="size-4 shrink-0"
                      strokeWidth={1.75}
                      style={{ color: STATUS[c].color }}
                    />
                    <span className="truncate">{name}</span>
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-display text-xl leading-none font-semibold tracking-[-0.02em] tabular-nums">
                      {count(metrics.totals.byClass[c])}
                    </span>
                    <TrendBadge
                      trend={trendOf(
                        metrics.totals.byClass[c],
                        metrics.previous.totals.requests > 0
                          ? metrics.previous.totals.byClass[c]
                          : null,
                      )}
                      polarity={
                        c === "4xx" || c === "5xx"
                          ? "lower-is-better"
                          : "neutral"
                      }
                      range={metrics.range}
                      locale={locale}
                      t={t}
                    />
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {s.peak(count(peak(values)))}
                  </span>
                  <MiniColumns
                    values={values}
                    labels={labels}
                    color={STATUS[c].color}
                    label={s.seriesLabel(
                      name,
                      count(metrics.totals.byClass[c]),
                      count(peak(values)),
                    )}
                    className="ml-auto h-8 w-36 shrink-0 sm:w-48"
                  />
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-2">
            <h3 className="heading">{s.codesHeading}</h3>
            {hidden > 0 ? (
              <p className="text-xs text-muted-foreground">
                {s.moreCodes(hidden)}
              </p>
            ) : null}
          </div>
          <ul className="surface divide-y divide-border">
            <li className="hidden items-center gap-x-5 px-4 py-2 text-xs text-muted-foreground md:flex md:px-5">
              <span className="w-12">{s.code}</span>
              <span className="w-48">{s.meaning}</span>
              <span className="w-16 text-right">{s.shareColumn}</span>
              <span className="w-20 text-right">{s.requests}</span>
              <span className="ml-auto w-36 text-right sm:w-48">
                {s.peakColumn}
              </span>
            </li>
            {cards.map((code) => {
              const statusClass = classOf(code.status);
              const color = statusClass
                ? STATUS[statusClass].color
                : "var(--viz-neutral)";
              const meaning = STATUS_CODES[code.status] ?? "";
              return (
                <li
                  key={code.status}
                  className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 md:px-5"
                >
                  <span
                    data-slot="status-code-card"
                    className="mono w-12 font-semibold tabular-nums"
                  >
                    {code.status}
                  </span>
                  <span className="w-48 min-w-0 truncate text-sm text-muted-foreground">
                    {meaning}
                  </span>
                  <span className="w-16 text-right text-sm tabular-nums">
                    {formatPercent(code.requests, total, locale)}
                  </span>
                  <span className="w-20 text-right text-sm font-medium tabular-nums">
                    {count(code.requests)}
                  </span>
                  <MiniColumns
                    values={code.series}
                    labels={labels}
                    color={color}
                    className="ml-auto h-8 w-36 shrink-0 sm:w-48"
                    label={s.seriesLabel(
                      `${code.status} ${meaning}`,
                      count(code.requests),
                      count(peak(code.series)),
                    )}
                  />
                </li>
              );
            })}
          </ul>

          <details className="surface px-5 text-sm md:px-7">
            <summary className="min-h-12 cursor-pointer py-3.5 text-muted-foreground">
              {t.metrics.chart.asTable}
            </summary>
            <div className="max-h-96 overflow-auto pb-5">
              <table className="w-full text-left tabular-nums">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1.5 pr-4 font-normal">{s.code}</th>
                    <th className="py-1.5 pr-4 font-normal">{s.meaning}</th>
                    <th className="py-1.5 pr-4 text-right font-normal">
                      {s.requests}
                    </th>
                    <th className="py-1.5 pr-4 text-right font-normal">
                      {s.shareColumn}
                    </th>
                    <th className="py-1.5 text-right font-normal">
                      {s.peakColumn}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((code) => (
                    <tr key={code.status} className="border-t">
                      <td className="py-1.5 pr-4 font-mono">{code.status}</td>
                      <td className="py-1.5 pr-4">
                        {STATUS_CODES[code.status] ?? ""}
                      </td>
                      <td className="py-1.5 pr-4 text-right">
                        {count(code.requests)}
                      </td>
                      <td className="py-1.5 pr-4 text-right">
                        {formatPercent(code.requests, total, locale)}
                      </td>
                      <td className="py-1.5 text-right">
                        {count(peak(code.series))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
