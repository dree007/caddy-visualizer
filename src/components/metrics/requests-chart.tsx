"use client";

import { useState } from "react";

import { useI18n } from "@/i18n/client";
import { formatCount } from "@/lib/format";

import { niceMax } from "./buckets";

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
  const point = (bucket: ChartBucket, index: number) => {
    const x = buckets.length > 1 ? (index / (buckets.length - 1)) * 100 : 50;
    const y = 100 - (max > 0 ? (bucket.requests / max) * 100 : 0);
    return { x, y };
  };
  const line = buckets
    .map((bucket, index) => {
      const { x, y } = point(bucket, index);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const area = `0,100 ${line} 100,100`;

  return (
    <section
      aria-labelledby="requests-heading"
      className="surface flex flex-col gap-3 p-5 md:p-7"
    >
      <h2 id="requests-heading" className="heading">
        {title}
      </h2>
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
          <div className="relative h-48" onPointerLeave={() => setActive(null)}>
            <svg
              aria-hidden
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full"
            >
              <polygon points={area} fill="var(--viz-series)" opacity="0.12" />
              <polyline
                points={line}
                fill="none"
                stroke="var(--viz-series)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {/* One hit target per bucket, so hover and focus name every value. */}
            <div className="absolute inset-0 flex">
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
                  className="h-full min-w-0 flex-1 cursor-default outline-none focus-visible:bg-ring/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                />
              ))}
            </div>
            {/* Hours with server errors: mark size grows with the count. */}
            <div aria-hidden className="absolute inset-x-0 bottom-2.5">
              {buckets.map((bucket, index) => {
                if (bucket.errors === 0) return null;
                const size = 5 + Math.min(9, Math.sqrt(bucket.errors) * 2.4);
                return (
                  <span
                    key={bucket.key}
                    className="absolute -translate-x-1/2 rounded-full"
                    style={{
                      left: `${point(bucket, index).x}%`,
                      width: size,
                      height: size,
                      background: "var(--viz-critical)",
                    }}
                  />
                );
              })}
            </div>
            {current ? (
              <div
                role="status"
                className="pointer-events-none absolute top-0 z-10 flex -translate-x-1/2 flex-col rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-soft-md"
                style={{
                  left: `clamp(4rem, ${((active! + 0.5) / buckets.length) * 100}%, calc(100% - 4rem))`,
                }}
              >
                <span className="text-sm font-semibold tabular-nums">
                  {c.requests(count(current.requests))}
                </span>
                <span className="text-muted-foreground">{current.label}</span>
                {current.errors > 0 ? (
                  <span
                    className="tabular-nums"
                    style={{ color: "var(--viz-critical)" }}
                  >
                    {c.errors(count(current.errors))}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
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
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ background: "var(--viz-critical)" }}
        />
        {c.errorMarks}
      </p>
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
