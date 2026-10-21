"use client";

import { useState } from "react";

import { useI18n } from "@/i18n/client";
import { formatCount } from "@/lib/format";

export interface ChartBucket {
  key: string;
  /** Axis label; empty for buckets without a tick. */
  tick: string;
  /** Full label for tooltip and table. */
  label: string;
  requests: number;
  errors: number;
}

/**
 * Requests per bucket as columns (one series, so no legend; the heading
 * names it). Each column is its own hover/focus target; the table view
 * holds every value.
 */
export function RequestsChart({
  title,
  buckets,
}: {
  title: string;
  buckets: ChartBucket[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const { locale, t } = useI18n();
  const c = t.metrics.chart;
  const count = (n: number) => formatCount(n, locale);
  const max = niceMax(Math.max(0, ...buckets.map((b) => b.requests)));
  const ticks = [max, max / 2, 0];
  const current = active === null ? null : buckets[active];

  return (
    <section
      aria-labelledby="requests-heading"
      className="surface flex flex-col gap-3 p-5 md:p-7"
    >
      <h3 id="requests-heading" className="heading">
        {title}
      </h3>
      <div className="flex gap-2">
        <div
          aria-hidden
          className="flex h-48 flex-col justify-between text-right text-xs text-muted-foreground tabular-nums"
        >
          {ticks.map((tick) => (
            <span key={tick} className="-my-1.5 leading-3">
              {count(tick)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div
            aria-hidden
            className="absolute inset-0 flex flex-col justify-between"
          >
            {ticks.map((tick) => (
              <span
                key={tick}
                className="block h-px"
                style={{ background: "var(--viz-grid)" }}
              />
            ))}
          </div>
          <div
            className="relative flex h-48 items-end gap-[2px]"
            onPointerLeave={() => setActive(null)}
          >
            {buckets.map((bucket, index) => (
              <button
                key={bucket.key}
                type="button"
                aria-label={c.bar(
                  bucket.label,
                  count(bucket.requests),
                  count(bucket.errors),
                )}
                onPointerEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className="group flex h-full min-w-0 flex-1 cursor-default items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span
                  className="block w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                  style={{
                    height: max > 0 ? `${(bucket.requests / max) * 100}%` : 0,
                    background: "var(--viz-series)",
                  }}
                />
              </button>
            ))}
          </div>
          {current ? (
            <div
              role="status"
              className="pointer-events-none absolute top-0 z-10 flex -translate-x-1/2 flex-col rounded-2xl bg-popover px-3.5 py-2.5 text-xs shadow-soft-lg"
              style={{
                left: `clamp(4rem, ${((active! + 0.5) / buckets.length) * 100}%, calc(100% - 4rem))`,
              }}
            >
              <span className="text-sm font-semibold tabular-nums">
                {c.requests(count(current.requests))}
              </span>
              <span className="text-muted-foreground">{current.label}</span>
              {current.errors > 0 ? (
                <span className="text-muted-foreground tabular-nums">
                  {c.errors(count(current.errors))}
                </span>
              ) : null}
            </div>
          ) : null}
          <div
            aria-hidden
            className="mt-1 flex gap-[2px] text-xs text-muted-foreground"
          >
            {buckets.map((bucket, index) => (
              <span key={bucket.key} className="relative h-4 min-w-0 flex-1">
                {bucket.tick ? (
                  <span
                    className={`absolute whitespace-nowrap ${
                      index === buckets.length - 1
                        ? "right-0"
                        : index === 0
                          ? "left-0"
                          : "left-1/2 -translate-x-1/2"
                    }`}
                  >
                    {bucket.tick}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      </div>
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-2 text-muted-foreground md:min-h-0">
          {c.asTable}
        </summary>
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 pr-4 font-normal">{c.period}</th>
                <th className="py-1 pr-4 text-right font-normal">
                  {c.requestsColumn}
                </th>
                <th className="py-1 text-right font-normal">
                  {c.errorsColumn}
                </th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((bucket) => (
                <tr key={bucket.key} className="border-t">
                  <td className="py-1 pr-4">{bucket.label}</td>
                  <td className="py-1 pr-4 text-right">
                    {count(bucket.requests)}
                  </td>
                  <td className="py-1 text-right">{count(bucket.errors)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

/** Rounds up to 1, 2 or 5 × 10^n, so the axis ticks are clean numbers. */
export function niceMax(value: number): number {
  if (value <= 0) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) {
    if (value <= step * power) return Math.max(step * power, 2);
  }
  return 10 * power;
}
