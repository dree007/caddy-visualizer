import { CircleCheck, CircleDashed, CircleMinus, CircleX } from "lucide-react";

import { getI18n } from "@/i18n/server";
import {
  formatCount,
  formatDateTime,
  formatMs,
  formatPercent,
} from "@/lib/format";
import {
  distributionRows,
  type UpstreamHealth,
} from "@/modules/access-log/upstream-rows";
import type { UpstreamDistribution as Distribution } from "@/server/access-log/queries";

import { MiniColumns } from "./mini-columns";

const HEALTH_ICON = {
  healthy: { icon: CircleCheck, color: "var(--viz-good)" },
  unhealthy: { icon: CircleX, color: "var(--viz-critical)" },
  disabled: { icon: CircleMinus, color: "var(--viz-neutral)" },
  unknown: { icon: CircleDashed, color: "var(--viz-neutral)" },
} satisfies Record<UpstreamHealth, unknown>;

/**
 * Measured requests per upstream of one load-balanced host, with Caddy's
 * current health view. Configured weights are shown as configuration only.
 */
export async function UpstreamDistribution({
  distribution,
}: {
  distribution: Distribution;
}) {
  const { locale, t } = await getI18n();
  const u = t.metrics.upstreams;
  const { metrics, configured, health } = distribution;
  const rows = distributionRows(
    metrics,
    configured,
    health?.state === "ok" ? health.health : null,
  );
  const measured = metrics.proxied + metrics.notProxied > 0;
  const weighted = rows.some((row) => row.weight !== null);

  return (
    <section
      aria-labelledby="upstreams-heading"
      className="surface flex flex-col gap-3 p-5 md:p-7"
    >
      <div className="flex flex-col gap-1">
        <h2 id="upstreams-heading" className="heading">
          {u.heading}
        </h2>
        <p className="text-sm text-muted-foreground">{u.intro}</p>
        <p className="text-xs text-muted-foreground">
          {u.window(
            formatDateTime(metrics.from, locale),
            formatDateTime(metrics.to, locale),
          )}
          {metrics.clipped ? ` · ${u.clipped}` : ""}
        </p>
      </div>

      {!measured ? (
        <p className="text-sm text-muted-foreground">{u.empty}</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b border-line-control/60">
                <th className="py-2 pr-4 font-normal">{u.upstream}</th>
                <th className="py-2 pr-4 font-normal">{u.health}</th>
                <th className="py-2 pr-4 text-right font-normal">
                  {u.requests}
                </th>
                <th className="py-2 pr-4 font-normal">{u.share}</th>
                <th className="py-2 pr-4 text-right font-normal">{u.errors}</th>
                <th className="py-2 pr-4 text-right font-normal">
                  {u.avgTime}
                </th>
                {weighted ? (
                  <th className="py-2 pr-4 text-right font-normal">
                    {u.weight}
                  </th>
                ) : null}
                <th className="py-2 font-normal">{u.overTime}</th>
              </tr>
            </thead>
            <tbody className="whitespace-nowrap tabular-nums">
              {rows.map((row) => {
                const { icon: Icon, color } = HEALTH_ICON[row.health];
                const share =
                  metrics.proxied > 0 ? row.requests / metrics.proxied : 0;
                const name = row.label ?? row.upstream;
                return (
                  <tr
                    key={row.upstream}
                    className="border-t border-border/70 align-middle"
                  >
                    <td className="py-2.5 pr-4">
                      {row.label ? (
                        <span className="block font-medium">{row.label}</span>
                      ) : null}
                      <span className="mono block text-muted-foreground">
                        {row.upstream}
                      </span>
                      {row.configured ? null : (
                        <span className="block text-xs text-muted-foreground">
                          {u.notConfigured}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <Icon
                          aria-hidden
                          className="size-4"
                          style={{ color }}
                        />
                        {u.states[row.health]}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {measured ? formatCount(row.requests, locale) : "–"}
                    </td>
                    <td className="py-2 pr-4">
                      {measured ? (
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="relative h-1.5 w-24 shrink-0 overflow-hidden rounded-sm"
                            style={{ background: "var(--viz-grid)" }}
                          >
                            <span
                              className="absolute inset-y-0 left-0"
                              style={{
                                width: `${share * 100}%`,
                                background: "var(--viz-series)",
                              }}
                            />
                          </span>
                          {formatPercent(row.requests, metrics.proxied, locale)}
                        </span>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {measured ? formatCount(row.errors, locale) : "–"}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {formatMs(row.avgMs, locale)}
                    </td>
                    {weighted ? (
                      <td className="py-2 pr-4 text-right text-muted-foreground">
                        {row.weight ?? "–"}
                      </td>
                    ) : null}
                    <td className="w-40 py-2">
                      {measured ? (
                        <MiniColumns
                          values={row.series}
                          labels={metrics.labels}
                          color="var(--viz-series)"
                          label={u.seriesLabel(
                            name,
                            formatCount(row.requests, locale),
                          )}
                          className="h-8"
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {metrics.notProxied > 0 ? (
                <tr className="border-t text-muted-foreground">
                  <td className="py-2 pr-4" colSpan={2}>
                    <span className="block">{u.notProxied}</span>
                    <span className="block text-xs whitespace-normal">
                      {u.notProxiedHint}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {formatCount(metrics.notProxied, locale)}
                  </td>
                  <td colSpan={weighted ? 5 : 4} />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {health?.state === "unreachable" ? u.healthUnavailable : u.healthNote}
        {weighted ? ` ${u.weightsNote}` : ""}
      </p>
    </section>
  );
}
