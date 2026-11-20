import {
  ChevronRight,
  CircleAlert,
  LayoutDashboard,
  Waypoints,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CertificateSummaryTiles } from "@/components/certificates/certificate-summary";
import { EmptyState } from "@/components/empty-state";
import { chartBuckets } from "@/components/metrics/buckets";
import { EventList, buildEvents } from "@/components/dashboard/events";
import { HostStatusTable } from "@/components/dashboard/host-status-table";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { SchematicDiagram } from "@/components/dashboard/schematic";
import { TrafficChart } from "@/components/dashboard/traffic-chart";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { translateCode } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { RANGES } from "@/modules/access-log/queries";
import {
  buildSchematic,
  type ProxyRoute,
} from "@/modules/access-log/schematic";
import {
  loadTrafficMetrics,
  loadUpstreamFlows,
} from "@/server/access-log/queries";
import { loadDashboardActivity } from "@/server/dashboard-activity";
import { summarize } from "@/modules/certificates/status";
import { loadRunningSites } from "@/server/caddy/admin";
import { loadCertificateOverview } from "@/server/certificates/checks";

import { RunningSites } from "./running-sites";
import { getDesign } from "@/server/design";

import ClassicDashboardPage from "./classic/classic-page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.dashboard.title };
}

async function SchematicDashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const params = await searchParams;
  const range = RANGES.find((r) => r === params.range) ?? "24h";
  const [running, traffic, flows, activity, { locale, t }] = await Promise.all([
    loadRunningSites(),
    loadTrafficMetrics(range),
    loadUpstreamFlows(range),
    loadDashboardActivity(),
    getI18n(),
  ]);
  const d = t.dashboard;
  // Stored results for the sites just read; no handshake on page view.
  const certificates =
    running.state === "ok" && running.sites.length > 0
      ? await loadCertificateOverview(running.sites)
      : null;

  const routes: ProxyRoute[] =
    running.state === "ok"
      ? running.sites.flatMap((site) => {
          const upstreams = site.targets.flatMap((target) =>
            target.kind === "proxy" ? target.upstreams : [],
          );
          return upstreams.length > 0 ? [{ hosts: site.hosts, upstreams }] : [];
        })
      : [];
  const schematic = buildSchematic(traffic.metrics.hosts, routes, flows);
  const buckets = chartBuckets(traffic.metrics, locale, t);
  const events = buildEvents(
    {
      errorBuckets: traffic.metrics.series.map((point, i) => ({
        start: point.start,
        label: buckets[i]!.label,
        errors: point.errors,
      })),
      revisions: activity.revisions,
      ingestion: activity.ingestion,
    },
    locale,
    t,
  );
  const hasTraffic =
    traffic.hosts.length > 0 && traffic.metrics.totals.requests > 0;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="min-w-0 flex-[1_1_420px]">
          <h2 className="display">{d.headline}</h2>
          <p className="mt-1.5 text-muted-foreground">
            {d.lead[range]}
            {activity.runningRevision !== null
              ? ` ${d.revision(activity.runningRevision)}`
              : ""}
          </p>
        </div>
        <nav
          aria-label={t.metrics.range}
          className="surface-pressed flex gap-1 p-1"
        >
          {RANGES.map((r) => (
            <Link
              key={r}
              href={{ pathname: "/dashboard", query: { range: r } }}
              aria-current={r === range ? "page" : undefined}
              className="inline-flex min-h-10 items-center rounded-md px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:bg-card aria-[current=page]:font-semibold aria-[current=page]:text-foreground md:min-h-8"
            >
              {t.metrics.ranges[r]}
            </Link>
          ))}
        </nav>
      </div>

      {hasTraffic ? (
        <>
          <SchematicDiagram
            data={schematic}
            caddyLabel={
              activity.runningRevision !== null
                ? `Rev #${activity.runningRevision}`
                : "live"
            }
            upstreamsClipped={range === "30d"}
            locale={locale}
            t={t}
          />
          <KpiRow metrics={traffic.metrics} locale={locale} t={t} />
          <div className="flex flex-wrap gap-7">
            <section
              aria-labelledby="traffic-heading"
              className="flex min-w-0 flex-[3_1_520px] flex-col gap-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="traffic-heading" className="heading text-xl">
                  {range === "24h"
                    ? t.metrics.requestsPerHour
                    : t.metrics.requestsPerDay}
                </h2>
                <Link
                  href={{ pathname: "/metrics", query: { range } }}
                  className="inline-flex min-h-11 items-center gap-1 text-sm hover:text-(--viz-series) md:min-h-8"
                >
                  {d.allMetrics}
                  <ChevronRight aria-hidden className="size-4" />
                </Link>
              </div>
              <TrafficChart
                buckets={buckets}
                title={
                  range === "24h"
                    ? t.metrics.requestsPerHour
                    : t.metrics.requestsPerDay
                }
                locale={locale}
                t={t}
              />
            </section>
            <section
              aria-labelledby="events-heading"
              className="flex min-w-0 flex-[2_1_340px] flex-col gap-3"
            >
              <h2 id="events-heading" className="heading text-xl">
                {d.events.heading}
              </h2>
              <EventList events={events} t={t} />
            </section>
          </div>
          <section
            aria-labelledby="status-heading"
            className="flex flex-col gap-3"
          >
            <h2 id="status-heading" className="heading text-xl">
              {d.statusPerHost.heading}
            </h2>
            <HostStatusTable
              hosts={traffic.metrics.hosts}
              range={range}
              locale={locale}
              t={t}
            />
          </section>
        </>
      ) : (
        <EmptyState
          icon={LayoutDashboard}
          title={d.noTrafficTitle}
          description={d.noTrafficText}
        />
      )}

      {certificates && certificates.views.length > 0 ? (
        <section
          aria-labelledby="certificates-heading"
          className="flex flex-col gap-3"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="certificates-heading" className="heading text-2xl">
              {d.certificatesHeading}
            </h2>
            <Link
              href="/certificates"
              className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:min-h-8"
            >
              {d.allCertificates}
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          </div>
          <CertificateSummaryTiles
            summary={summarize(certificates.views)}
            locale={locale}
            t={t}
          />
        </section>
      ) : null}

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

/** "Klassisch" is the page as on main; "Schaltplan" is the redesign. */
export default async function DashboardPage(props: PageProps<"/dashboard">) {
  if ((await getDesign()) === "classic") return ClassicDashboardPage();
  return SchematicDashboardPage(props);
}
