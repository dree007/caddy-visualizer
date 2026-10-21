import Link from "next/link";

import { getI18n } from "@/i18n/server";
import { formatBytes, formatCount, formatMs } from "@/lib/format";
import type { HostRow, Range } from "@/modules/access-log/queries";

export async function HostsTable({
  hosts,
  range,
}: {
  hosts: HostRow[];
  range: Range;
}) {
  const { locale, t } = await getI18n();
  const h = t.metrics.hosts;
  return (
    <section
      aria-labelledby="hosts-heading"
      className="surface flex flex-col gap-3 p-5 md:p-7"
    >
      <h3 id="hosts-heading" className="heading">
        {h.heading}
      </h3>
      {hosts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{h.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-normal">{h.host}</th>
                <th className="py-2 pr-4 text-right font-normal">
                  {h.requests}
                </th>
                <th className="py-2 pr-4 text-right font-normal">
                  {h.traffic}
                </th>
                <th className="py-2 pr-4 text-right font-normal">{h.errors}</th>
                <th className="py-2 text-right font-normal">{h.avgTime}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {hosts.map((host) => (
                <tr key={host.host} className="border-t">
                  <td className="py-2 pr-4">
                    <Link
                      href={{
                        pathname: "/metrics",
                        query: { range, host: host.host },
                      }}
                      className="font-medium [overflow-wrap:anywhere] hover:underline"
                    >
                      {host.host}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {formatCount(host.requests, locale)}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {formatBytes(host.bytes, locale)}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {formatCount(host.errors, locale)}
                  </td>
                  <td className="py-2 text-right">
                    {formatMs(host.avgMs, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
