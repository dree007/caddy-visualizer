import type { Locale, Messages } from "@/i18n";
import { formatCount } from "@/lib/format";
import { niceMax } from "@/components/metrics/buckets";
import type { ChartBucket } from "@/components/metrics/requests-chart";

const W = 720;
const LEFT = 52;
// Room for the 5xx dot of the newest bucket (radius up to 6).
const RIGHT = 8;
const TOP = 20;
const BASE = 190;

/** Requests per bucket as an area line; red dots mark buckets with 5xx. */
export function TrafficChart({
  buckets,
  title,
  locale,
  t,
}: {
  buckets: ChartBucket[];
  title: string;
  locale: Locale;
  t: Messages;
}) {
  const c = t.metrics.chart;
  const count = (n: number) => formatCount(n, locale);
  const max = niceMax(Math.max(0, ...buckets.map((b) => b.requests)));
  const maxErrors = Math.max(1, ...buckets.map((b) => b.errors));
  const step =
    buckets.length > 1 ? (W - LEFT - RIGHT) / (buckets.length - 1) : 0;
  const x = (i: number) => (buckets.length > 1 ? LEFT + i * step : W / 2);
  const y = (v: number) => BASE - (v / max) * (BASE - TOP);
  const points = buckets.map(
    (b, i) => `${x(i).toFixed(1)},${y(b.requests).toFixed(1)}`,
  );
  const peak = buckets.reduce(
    (a, b) => (b.requests > a.requests ? b : a),
    buckets[0]!,
  );
  const ticks = [max, max / 2, 0];
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <svg
        viewBox={`0 0 ${W} 220`}
        role="img"
        aria-label={`${title}: ${c.requests(count(peak.requests))}, ${peak.label}`}
        className="block h-auto w-full"
      >
        <g stroke="var(--viz-grid)" strokeWidth="1">
          {ticks.map((tick) => (
            <line key={tick} x1={LEFT} x2={W} y1={y(tick)} y2={y(tick)} />
          ))}
        </g>
        <line
          x1={LEFT}
          x2={W}
          y1={BASE}
          y2={BASE}
          stroke="var(--viz-neutral)"
        />
        <g fontSize="11" fill="var(--muted-foreground)">
          {ticks.map((tick) => (
            <text key={tick} x={LEFT - 8} y={y(tick) + 4} textAnchor="end">
              {count(tick)}
            </text>
          ))}
          {buckets.map((b, i) =>
            b.tick ? (
              <text
                key={b.key}
                x={x(i)}
                y="210"
                textAnchor={
                  i === 0
                    ? "start"
                    : i === buckets.length - 1
                      ? "end"
                      : "middle"
                }
              >
                {b.tick}
              </text>
            ) : null,
          )}
        </g>
        {buckets.length > 0 ? (
          <>
            <polygon
              points={`${x(0)},${BASE} ${points.join(" ")} ${x(buckets.length - 1)},${BASE}`}
              fill="var(--viz-series)"
              opacity="0.12"
            />
            <polyline
              points={points.join(" ")}
              fill="none"
              stroke="var(--viz-series)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </>
        ) : null}
        <g fill="var(--viz-critical)">
          {buckets.map((b, i) =>
            b.errors > 0 ? (
              <circle
                key={b.key}
                cx={x(i)}
                cy="196"
                r={(2 + Math.sqrt(b.errors / maxErrors) * 4).toFixed(1)}
              >
                <title>{`${b.label}: ${c.errors(count(b.errors))}`}</title>
              </circle>
            ) : null,
          )}
        </g>
      </svg>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="mr-1.5 inline-block size-2 rounded-full bg-(--viz-critical)" />
        {t.dashboard.chartLegend}
      </p>
    </div>
  );
}
