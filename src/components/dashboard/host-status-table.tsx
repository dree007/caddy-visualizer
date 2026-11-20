import Link from "next/link";

import type { Locale, Messages } from "@/i18n";
import { formatCount } from "@/lib/format";
import type { HostRow, Range } from "@/modules/access-log/queries";

export const HOST_ROWS = 10;

/** Share of each status class as a stacked bar; a 5xx sliver stays visible. */
export function barShares(row: Pick<HostRow, "requests" | "byClass">) {
  const n = row.requests;
  if (n === 0) return { ok: 0, redirect: 0, client: 0, server: 0 };
  const server =
    row.byClass["5xx"] > 0 ? Math.max(0.6, (row.byClass["5xx"] / n) * 100) : 0;
  const client = (row.byClass["4xx"] / n) * 100;
  const redirect = (row.byClass["3xx"] / n) * 100;
  const ok = Math.max(0, 100 - server - client - redirect);
  return { ok, redirect, client, server };
}

export function HostStatusTable({
  hosts,
  range,
  locale,
  t,
}: {
  hosts: HostRow[];
  range: Range;
  locale: Locale;
  t: Messages;
}) {
  const d = t.dashboard.statusPerHost;
  const s = t.metrics.status;
  const shown = hosts.slice(0, HOST_ROWS);
  const legend = [
    ["2xx", "var(--viz-series)"],
    ["3xx", "#7fb7b4"],
    ["4xx", "var(--viz-warning)"],
    ["5xx", "var(--viz-critical)"],
  ] as const;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card px-5 py-2">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th scope="col" className="py-2.5 font-medium">
              {d.host}
            </th>
            <th scope="col" className="w-[55%] px-3 py-2.5 font-medium">
              {d.distribution}
            </th>
            <th scope="col" className="py-2.5 text-right font-medium">
              {d.errors4xx}
            </th>
            <th scope="col" className="py-2.5 pl-3 text-right font-medium">
              {d.errors5xx}
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {shown.map((row) => {
            const share = barShares(row);
            return (
              <tr key={row.host} className="border-t border-(--viz-grid)">
                <th
                  scope="row"
                  className="py-3 text-left font-normal whitespace-nowrap"
                >
                  <Link
                    href={{
                      pathname: "/metrics",
                      query: { range, host: row.host },
                    }}
                    className="mono hover:underline"
                  >
                    {row.host}
                  </Link>
                </th>
                <td className="p-3">
                  <div
                    aria-hidden
                    className="flex h-2.5 overflow-hidden rounded-full bg-(--viz-grid)"
                  >
                    <div
                      style={{
                        width: `${share.ok}%`,
                        background: "var(--viz-series)",
                      }}
                    />
                    <div
                      style={{
                        width: `${share.redirect}%`,
                        background: "#7fb7b4",
                      }}
                    />
                    <div
                      style={{
                        width: `${share.client}%`,
                        background: "var(--viz-warning)",
                      }}
                    />
                    <div
                      style={{
                        width: `${share.server}%`,
                        background: "var(--viz-critical)",
                      }}
                    />
                  </div>
                </td>
                <td className="py-3 text-right">
                  {formatCount(row.byClass["4xx"], locale)}
                </td>
                <td
                  className={`py-3 pl-3 text-right font-semibold ${row.byClass["5xx"] > 10 ? "text-(--status-error)" : ""}`}
                >
                  {formatCount(row.byClass["5xx"], locale)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hosts.length > shown.length ? (
        <p className="mt-1 text-sm text-muted-foreground">
          <Link
            href={{ pathname: "/metrics", query: { range } }}
            className="hover:underline"
          >
            {d.more(hosts.length - shown.length)}
          </Link>
        </p>
      ) : null}
      <p className="mt-1 mb-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
        {legend.map(([c, color]) => (
          <span key={c}>
            <span
              aria-hidden
              className="mr-1.5 inline-block size-2.5 rounded-[2px]"
              style={{ background: color }}
            />
            {c} {s[c]}
          </span>
        ))}
      </p>
    </div>
  );
}
