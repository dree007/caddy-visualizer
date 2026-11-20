import Link from "next/link";

import { getI18n } from "@/i18n/server";
import { formatBytes, formatCount, formatMs } from "@/lib/format";
import type { HostRow, Range } from "@/modules/access-log/queries";
import { trendOf } from "@/modules/access-log/trends";

import { TrendBadge } from "./trend";

export async function HostsTable({
  hosts,
  previous,
  range,
}: {
  hosts: HostRow[];
  /** The same hosts in the previous period, for the trends. */
  previous: HostRow[];
  range: Range;
}) {
  const { locale, t } = await getI18n();
  const h = t.metrics.hosts;
  const before = new Map(previous.map((row) => [row.host, row]));
  // A host without traffic before is "new", unless there was no traffic at all.
  const missing = previous.length > 0 ? 0 : null;
  return (
    <section
      aria-labelledby="hosts-heading"
      className="surface flex flex-col gap-3 p-5 md:p-7"
    >
      <h2 id="hosts-heading" className="heading">
        {h.heading}
      </h2>
      {hosts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{h.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm sm:min-w-[36rem]">
            <thead className="text-muted-foreground">
              <tr className="border-b border-line-control/60">
                <th className="py-2 pr-4 font-normal">{h.host}</th>
                <th className="py-2 pr-4 text-right font-normal">
                  {h.requests}
                </th>
                <th className="hidden py-2 pr-4 text-right font-normal sm:table-cell">
                  {h.traffic}
                </th>
                <th className="py-2 pr-4 text-right font-normal">{h.errors}</th>
                <th className="hidden py-2 text-right font-normal sm:table-cell">
                  {h.avgTime}
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {hosts.map((host) => {
                const earlier = before.get(host.host);
                return (
                  <tr key={host.host} className="border-t border-border/70">
                    <td className="py-2.5 pr-4">
                      <Link
                        href={{
                          pathname: "/metrics",
                          query: { range, host: host.host },
                        }}
                        className="mono font-medium whitespace-nowrap underline-offset-4 hover:text-violet-ink hover:underline"
                      >
                        {host.host}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <span className="flex flex-col items-end">
                        {formatCount(host.requests, locale)}
                        <TrendBadge
                          trend={trendOf(
                            host.requests,
                            earlier?.requests ?? missing,
                          )}
                          polarity="neutral"
                          range={range}
                          locale={locale}
                          t={t}
                        />
                      </span>
                    </td>
                    <td className="hidden py-2 pr-4 text-right sm:table-cell">
                      {formatBytes(host.bytes, locale)}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <span className="flex flex-col items-end">
                        {formatCount(host.errors, locale)}
                        {host.errors > 0 || (earlier?.errors ?? 0) > 0 ? (
                          <TrendBadge
                            trend={trendOf(
                              host.errors,
                              earlier?.errors ?? missing,
                            )}
                            polarity="lower-is-better"
                            range={range}
                            locale={locale}
                            t={t}
                          />
                        ) : null}
                      </span>
                    </td>
                    <td className="hidden py-2 text-right sm:table-cell">
                      {formatMs(host.avgMs, locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
