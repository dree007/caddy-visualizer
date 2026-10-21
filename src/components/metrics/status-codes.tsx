import { STATUS_CODES } from "node:http";

import { getI18n } from "@/i18n/server";
import { formatCount, formatPercent } from "@/lib/format";
import {
  classOf,
  type Metrics,
  STATUS_CLASSES,
} from "@/modules/access-log/queries";

import { MiniColumns } from "./mini-columns";
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
  const cards = metrics.codes.slice(0, CARD_LIMIT);
  const hidden = metrics.codes.length - cards.length;

  return (
    <section aria-labelledby="status-heading" className="flex flex-col gap-4">
      <div className="mt-4 flex flex-col gap-1">
        <h2 id="status-heading" className="heading text-2xl">
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
          <ul className="grid gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-4">
            {STATUS_CLASSES.map((c) => {
              const values = metrics.series.map((point) => point.byClass[c]);
              const Icon = STATUS[c].icon;
              const name = `${c} · ${s[c]}`;
              return (
                <li key={c} className="surface flex flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <Icon
                        aria-hidden
                        className="size-4 shrink-0"
                        strokeWidth={1.75}
                        style={{ color: STATUS[c].color }}
                      />
                      <span className="truncate">{name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {s.peak(count(peak(values)))}
                    </span>
                  </div>
                  <p className="font-display text-[1.75rem] leading-none font-light tracking-[-0.02em] tabular-nums">
                    {count(metrics.totals.byClass[c])}
                  </p>
                  <MiniColumns
                    values={values}
                    labels={labels}
                    color={STATUS[c].color}
                    label={s.seriesLabel(
                      name,
                      count(metrics.totals.byClass[c]),
                      count(peak(values)),
                    )}
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
          <ul className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            {cards.map((code) => {
              const statusClass = classOf(code.status);
              const color = statusClass
                ? STATUS[statusClass].color
                : "var(--viz-neutral)";
              const meaning = STATUS_CODES[code.status] ?? "";
              return (
                <li
                  key={code.status}
                  className="surface-band flex min-w-0 flex-col gap-3 p-5"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-[2rem] leading-none font-light tracking-[-0.02em] tabular-nums">
                      {code.status}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatPercent(code.requests, total, locale)}
                    </span>
                  </div>
                  <p className="-mt-1 truncate text-sm text-muted-foreground">
                    {meaning}
                  </p>
                  <MiniColumns
                    values={code.series}
                    labels={labels}
                    color={color}
                    className="h-10"
                    label={s.seriesLabel(
                      `${code.status} ${meaning}`,
                      count(code.requests),
                      count(peak(code.series)),
                    )}
                  />
                  <p className="text-sm tabular-nums">{count(code.requests)}</p>
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
                  {metrics.codes.map((code) => (
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
