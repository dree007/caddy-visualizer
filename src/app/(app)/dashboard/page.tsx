import {
  ChevronRight,
  CircleAlert,
  LayoutDashboard,
  Waypoints,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { chartBuckets } from "@/components/metrics/buckets";
import { RequestsChart } from "@/components/metrics/requests-chart";
import { StatTiles } from "@/components/metrics/stat-tiles";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { translateCode } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { loadTrafficMetrics } from "@/server/access-log/queries";
import { loadRunningSites } from "@/server/caddy/admin";

import { RunningSites } from "./running-sites";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.dashboard.title };
}

export default async function DashboardPage() {
  const [running, traffic, { locale, t }] = await Promise.all([
    loadRunningSites(),
    loadTrafficMetrics("24h"),
    getI18n(),
  ]);
  const d = t.dashboard;

  return (
    <div className="flex flex-col gap-10">
      <section
        aria-labelledby="traffic-heading"
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="traffic-heading" className="heading text-2xl">
            {d.last24h}
          </h2>
          <Link
            href="/metrics"
            className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:min-h-8"
          >
            {d.allMetrics}
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>
        {traffic.hosts.length === 0 ? (
          <EmptyState
            icon={LayoutDashboard}
            title={d.noTrafficTitle}
            description={d.noTrafficText}
          />
        ) : (
          <>
            <StatTiles metrics={traffic.metrics} />
            <RequestsChart
              title={d.requestsPerHour}
              buckets={chartBuckets(traffic.metrics, locale, t)}
            />
          </>
        )}
      </section>

      <section
        aria-labelledby="running-heading"
        className="flex flex-col gap-4"
      >
        <div className="min-w-0">
          <h2 id="running-heading" className="heading text-2xl">
            {d.sitesHeading}
          </h2>
          <p className="text-sm text-muted-foreground">
            {running.state === "ok"
              ? d.sitesCount(running.sites.length)
              : d.sitesLive}
          </p>
        </div>
        {running.state === "ok" ? (
          running.sites.length === 0 ? (
            <EmptyState
              icon={Waypoints}
              title={d.noSitesTitle}
              description={d.noSitesText}
            />
          ) : (
            <RunningSites sites={running.sites} />
          )
        ) : (
          <Alert
            variant={
              running.state === "unreachable" ? "destructive" : "default"
            }
          >
            <CircleAlert aria-hidden />
            <AlertDescription>
              {running.state === "unreachable"
                ? translateCode(t, running.message)
                : t.common.notConfigured}
            </AlertDescription>
          </Alert>
        )}
      </section>
    </div>
  );
}
