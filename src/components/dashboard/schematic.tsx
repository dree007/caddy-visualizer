import type { Locale, Messages } from "@/i18n";
import { formatCount, formatMs } from "@/lib/format";
import type { Schematic } from "@/modules/access-log/schematic";

import {
  BOX_WIDTH,
  BOX_X,
  LEFT_X,
  type Layout,
  type LayoutRow,
  layoutSchematic,
  RIGHT_X,
  VIEW_WIDTH,
} from "./schematic-layout";

const MAX_CHARS = 30;

function clip(value: string): string {
  return value.length > MAX_CHARS ? `${value.slice(0, MAX_CHARS - 1)}…` : value;
}

/** Curve from (x1, y1) to (x2, y2), like the reference: flat at both ends. */
function curve(x1: number, y1: number, x2: number, y2: number): string {
  const dx = (x2 - x1) * 0.42;
  return `M${x1} ${y1.toFixed(1)} C ${x1 + dx} ${y1.toFixed(1)}, ${x2 - dx - 10} ${y2.toFixed(1)}, ${x2} ${y2.toFixed(1)}`;
}

/**
 * The wiring diagram: host names → Caddy → upstreams. Line width follows the
 * requests; server errors (5xx) are a mark at the upstream. A text list of
 * the same rows is provided for screen readers.
 */
export function SchematicDiagram({
  data,
  caddyLabel,
  upstreamsClipped = false,
  locale,
  t,
}: {
  data: Schematic;
  /** Second line in the Caddy box, e.g. `Rev #2`. */
  caddyLabel: string;
  /** The upstream side covers a shorter window than the host side. */
  upstreamsClipped?: boolean;
  locale: Locale;
  t: Messages;
}) {
  const s = t.dashboard.schematic;
  const layout: Layout = layoutSchematic(data);
  const count = (n: number) => formatCount(n, locale);
  const total =
    data.hosts.reduce((n, h) => n + h.requests, 0) + data.moreHosts.requests;
  const upstreamByKey = new Map(data.upstreams.map((u) => [u.upstream, u]));
  const hostByKey = new Map(data.hosts.map((h) => [h.host, h]));
  const centerY = layout.boxY + layout.boxHeight / 2;
  const hasEstimate = data.upstreams.some((u) => u.estimated);

  const rowLabel = (row: LayoutRow, kind: "host" | "upstream") =>
    row.more
      ? kind === "host"
        ? s.moreHosts(data.moreHosts.count)
        : s.moreUpstreams(data.moreUpstreams.count)
      : row.key;

  return (
    <figure className="m-0 overflow-x-auto rounded-xl border border-border bg-card [background-image:radial-gradient(var(--viz-grid)_1px,transparent_1px)] [background-size:20px_20px] p-4 md:p-6">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${layout.height}`}
        role="img"
        aria-label={s.alt(
          data.hosts.length + data.moreHosts.count,
          data.upstreams.length + data.moreUpstreams.count,
          count(total),
        )}
        className="block h-auto w-full min-w-[860px]"
      >
        <g fill="none" stroke="var(--viz-series)" opacity="0.88">
          {layout.hosts.map((row) => (
            <path
              key={`l-${row.key}`}
              d={curve(LEFT_X, row.y - 5, BOX_X, row.attachY)}
              strokeWidth={row.stroke.toFixed(2)}
              strokeDasharray={row.more ? "6 4" : undefined}
            />
          ))}
          {layout.upstreams.map((row) => (
            <path
              key={`r-${row.key}`}
              d={curve(BOX_X + BOX_WIDTH, row.attachY, RIGHT_X, row.y - 5)}
              strokeWidth={row.stroke.toFixed(2)}
              strokeDasharray={row.more ? "6 4" : undefined}
            />
          ))}
        </g>
        <g fill="var(--viz-critical)">
          {layout.upstreams
            .filter((row) => row.errors > 0)
            .map((row) => (
              <rect
                key={`e-${row.key}`}
                x={RIGHT_X - 3}
                y={row.y - 5 - row.stroke / 2}
                width="5"
                height={row.stroke}
                rx="1"
              />
            ))}
        </g>
        <rect
          x={BOX_X}
          y={layout.boxY}
          width={BOX_WIDTH}
          height={layout.boxHeight}
          rx="14"
          fill="var(--primary)"
        />
        <text
          x={BOX_X + BOX_WIDTH / 2}
          y={centerY - 2}
          textAnchor="middle"
          fill="var(--primary-foreground)"
          fontSize="20"
          fontWeight="700"
          className="font-display"
        >
          Caddy
        </text>
        <text
          x={BOX_X + BOX_WIDTH / 2}
          y={centerY + 23}
          textAnchor="middle"
          fill="var(--primary-foreground)"
          opacity="0.7"
          fontSize="12"
          className="font-mono"
        >
          {caddyLabel}
        </text>

        {layout.hosts.map((row) => {
          const host = hostByKey.get(row.key);
          return (
            <g key={`ht-${row.key}`} textAnchor="end">
              <title>{rowLabel(row, "host")}</title>
              <text
                x={LEFT_X - 12}
                y={row.y - 4}
                fontSize="14"
                fill="var(--foreground)"
                className="font-mono"
              >
                {row.more ? rowLabel(row, "host") : clip(row.key)}
              </text>
              <text
                x={LEFT_X - 12}
                y={row.y + 15}
                fontSize="13"
                fill="var(--muted-foreground)"
              >
                {s.requests(count(row.requests))}
                {host && host.errors > 0
                  ? ` · ${s.errors(count(host.errors))}`
                  : ""}
              </text>
            </g>
          );
        })}
        {layout.upstreams.map((row) => {
          const upstream = upstreamByKey.get(row.key);
          return (
            <g key={`ut-${row.key}`}>
              <title>{rowLabel(row, "upstream")}</title>
              <text
                x={RIGHT_X + 14}
                y={row.y - 4}
                fontSize="14"
                fill="var(--foreground)"
                className="font-mono"
              >
                {row.more ? rowLabel(row, "upstream") : clip(row.key)}
              </text>
              <text
                x={RIGHT_X + 14}
                y={row.y + 15}
                fontSize="13"
                fill="var(--muted-foreground)"
              >
                {upstream
                  ? formatMs(upstream.avgMs, locale)
                  : s.requests(count(row.requests))}
              </text>
              {row.errors > 0 ? (
                <g fontSize="13" fontWeight="600">
                  <rect
                    x={RIGHT_X + (row.more ? 150 : 66)}
                    y={row.y + 1}
                    width="82"
                    height="20"
                    rx="4"
                    fill="var(--status-error-soft)"
                  />
                  <text
                    x={RIGHT_X + (row.more ? 191 : 107)}
                    y={row.y + 15}
                    textAnchor="middle"
                    fill="var(--status-error)"
                  >
                    {s.errors(count(row.errors))}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
        <g fontSize="12" fill="var(--muted-foreground)">
          <text x={LEFT_X} y={layout.height - 8}>
            {s.hosts}
          </text>
          <text
            x={BOX_X + BOX_WIDTH / 2}
            y={layout.height - 8}
            textAnchor="middle"
          >
            {s.proxy}
          </text>
          <text x={RIGHT_X} y={layout.height - 8} textAnchor="end">
            {s.upstreams}
          </text>
        </g>
      </svg>
      <ul className="sr-only">
        {layout.hosts.map((row) => (
          <li key={row.key}>
            {s.altRow(
              rowLabel(row, "host"),
              count(row.requests),
              row.errors > 0 ? s.errors(count(row.errors)) : "",
            )}
          </li>
        ))}
        {layout.upstreams.map((row) => (
          <li key={row.key}>
            {s.altRow(
              rowLabel(row, "upstream"),
              count(row.requests),
              row.errors > 0 ? s.errors(count(row.errors)) : "",
            )}
          </li>
        ))}
      </ul>
      {data.upstreams.length === 0 ? (
        <figcaption className="mt-2 text-sm text-muted-foreground">
          {s.noUpstreams}
        </figcaption>
      ) : (
        <>
          {hasEstimate ? (
            <figcaption className="mt-2 text-sm text-muted-foreground">
              {s.estimated}
            </figcaption>
          ) : null}
          {upstreamsClipped ? (
            <figcaption className="mt-2 text-sm text-muted-foreground">
              {s.clipped}
            </figcaption>
          ) : null}
        </>
      )}
    </figure>
  );
}
