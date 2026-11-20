import { ChartLine } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { chartBuckets } from "@/components/classic/metrics/buckets";
import { HostsTable } from "@/components/classic/metrics/hosts-table";
import { MetricsFilters } from "@/components/classic/metrics/metrics-filters";
import { RequestsChart } from "@/components/classic/metrics/requests-chart";
import { StatTiles } from "@/components/classic/metrics/stat-tiles";
import { StatusCodes } from "@/components/classic/metrics/status-codes";
import { UpstreamDistribution } from "@/components/classic/metrics/upstream-distribution";
import { getI18n } from "@/i18n/server";
import { normalizeHost } from "@/modules/access-log/parser";
import { RANGES } from "@/modules/access-log/queries";
import {
  loadTrafficMetrics,
  loadUpstreamDistribution,
} from "@/server/access-log/queries";

export default async function MetricsPage({
  searchParams,
}: PageProps<"/metrics">) {
  const params = await searchParams;
  const range = RANGES.find((r) => r === params.range) ?? "24h";
  const host =
    typeof params.host === "string" ? normalizeHost(params.host) : null;
  const [{ metrics, hosts }, { locale, t }, distribution] = await Promise.all([
    loadTrafficMetrics(range, host ?? undefined),
    getI18n(),
    // Per upstream only for one host: shares across hosts mean nothing.
    host ? loadUpstreamDistribution(range, host) : null,
  ]);

  const buckets = chartBuckets(metrics, locale, t);

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <MetricsFilters range={range} host={host} hosts={hosts} />
      {hosts.length === 0 ? (
        <EmptyState
          icon={ChartLine}
          title={t.metrics.emptyTitle}
          description={t.metrics.emptyText}
        />
      ) : (
        <>
          <StatTiles metrics={metrics} />
          <RequestsChart
            title={
              range === "24h"
                ? t.metrics.requestsPerHour
                : t.metrics.requestsPerDay
            }
            buckets={buckets}
          />
          {distribution ? (
            <UpstreamDistribution distribution={distribution} />
          ) : null}
          <StatusCodes
            metrics={metrics}
            labels={buckets.map((bucket) => bucket.label)}
          />
          <HostsTable
            hosts={metrics.hosts}
            previous={metrics.previous.hosts}
            range={range}
          />
        </>
      )}
    </div>
  );
}
