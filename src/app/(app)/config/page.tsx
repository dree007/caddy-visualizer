import { FilePenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { Messages } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { formatDateTime } from "@/lib/format";
import { sha256Of } from "@/lib/sha256";
import { listCaddyfileSites } from "@/modules/caddy/caddyfile-sites";
import { parseSiteHostname } from "@/modules/caddy/hostname";
import { definesAccessLogSnippet } from "@/modules/caddy/main-caddyfile";
import { loadSitesOverview } from "@/modules/caddy/overview";
import { parseSnapshot, pendingChanges } from "@/modules/caddy/pending-changes";
import { listRevisions } from "@/modules/caddy/revisions";
import { loadSyncStatus } from "@/modules/caddy/sync-status";
import { requireAccess } from "@/server/auth/session";
import { loadRunningSites } from "@/server/caddy/admin";
import {
  instanceLockFailure,
  isApplyRunning,
  isCaddyConfigured,
  readMainCaddyfile,
} from "@/server/caddy/engine";
import type { ApplyOutcome } from "@/server/caddy/site-form";
import { getDb } from "@/server/db";

import { CaddyfileAccessLog } from "./caddyfile-access-log";
import { ConfigPreview } from "./config-preview";
import { FlashNotice } from "./flash-notice";
import { RevisionHistory } from "./revision-history";
import { PendingPanel } from "./pending-panel";
import { RouteDraftProvider } from "./route-draft";
import {
  type CaddyfileRowItem,
  type SiteListItem,
  SiteList,
} from "./site-list";
import { applySentence, type Tone } from "./sync-labels";
import { SyncStatusPanel } from "./sync-status-panel";
import { getDesign } from "@/server/design";

import ClassicConfigPage from "./classic/classic-page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.config.title };
}

const HISTORY_LENGTH = 10;

async function SchematicConfigPage({ searchParams }: PageProps<"/config">) {
  await requireAccess();
  const { locale, t } = await getI18n();
  const c = t.config;
  const db = getDb();
  const configured = isCaddyConfigured();
  const main = configured ? await readMainCaddyfile().catch(() => null) : null;
  const [{ sites, preview }, sync] = await Promise.all([
    loadSitesOverview(db, {
      accessLog: main !== null && definesAccessLogSnippet(main),
    }),
    loadSyncStatus(db, {
      configured,
      applying: isApplyRunning(),
      lockFailure: configured ? (instanceLockFailure()?.reason ?? null) : null,
      readMain: main === null ? undefined : async () => main,
    }),
  ]);
  const revisions = configured ? listRevisions(db, HISTORY_LENGTH) : [];
  const notice = noticeOf(t, await searchParams);

  const items: SiteListItem[] = sites.map((site) => ({
    id: site.id,
    hostname: site.hostname,
    target:
      site.kind === "redirect"
        ? {
            kind: "redirect",
            url: site.redirectTarget ?? "",
            code: site.redirectCode ?? 0,
          }
        : {
            kind: "proxy",
            url: site.upstream ?? "",
            skipTlsVerify: site.upstreamSkipTlsVerify,
            headers: site.upstreamHeaders.length,
            upstreams:
              site.loadBalancing?.backends.filter((b) => b.enabled).length ?? 0,
          },
    tls: site.tls,
    basicAuth: site.basicAuthHash !== null,
    enabled: site.enabled,
    updatedAt: site.updatedAt.toISOString(),
    updatedLabel: formatDateTime(site.updatedAt, locale),
  }));
  const enabledCount = sites.filter((site) => site.enabled).length;
  const running = configured ? await loadRunningSites() : null;
  const caddyfileSites = main === null ? [] : listCaddyfileSites(main);
  const caddyfileRows: CaddyfileRowItem[] = caddyfileSites.flatMap((block) =>
    block.addresses.map((address) => ({
      key: `${block.index}:${address}`,
      host: address,
      target: targetOf(running, address),
      line: block.line,
    })),
  );

  // Nothing is pending while Caddy already runs what is stored.
  const applied = sync.lastApplied
    ? parseSnapshot(sync.lastApplied.sitesSnapshot)
    : null;
  const changes =
    sync.state === "synced" || sync.state === "idle"
      ? []
      : pendingChanges(applied, sites);

  return (
    <RouteDraftProvider>
      <div className="flex flex-wrap items-start gap-7">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-6">
          {notice ? (
            <FlashNotice message={notice.text} tone={notice.tone} />
          ) : null}

          <section
            aria-labelledby="sources-heading"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
              <div className="min-w-0 flex-[1_1_22rem]">
                <h2 id="sources-heading" className="heading text-2xl">
                  {c.heading}
                </h2>
                <p className="text-sm text-muted-foreground">{c.intro}</p>
                <p className="mt-1 text-sm">
                  {c.routes.count(sites.length, enabledCount)}
                </p>
              </div>
              {configured ? (
                <Button
                  asChild
                  variant="outline"
                  className="w-fit max-md:h-11 max-sm:w-full"
                >
                  <Link href="/config/caddyfile">
                    <FilePenLine aria-hidden data-icon="inline-start" />
                    {c.openCaddyfile}
                  </Link>
                </Button>
              ) : null}
            </div>

            <SyncStatusPanel status={sync} locale={locale} t={t} />
          </section>

          {main !== null && caddyfileSites.length > 0 ? (
            <CaddyfileAccessLog
              sites={caddyfileSites}
              baseSha256={sha256Of(main)}
              snippetDefined={definesAccessLogSnippet(main)}
            />
          ) : null}

          <SiteList sites={items} caddyfileRows={caddyfileRows} />

          <RevisionHistory
            revisions={revisions}
            active={sync.lastApplied}
            canApply={configured}
            locale={locale}
            t={t}
          />
        </div>

        <PendingPanel
          changes={changes}
          configured={configured}
          base={
            sync.lastApplied
              ? {
                  number: sync.lastApplied.number,
                  sha256: sync.lastApplied.configSha256,
                }
              : null
          }
        >
          {items.length > 0 ? (
            <ConfigPreview
              preview={preview}
              sync={sync}
              locale={locale}
              t={t}
            />
          ) : null}
        </PendingPanel>
      </div>
    </RouteDraftProvider>
  );
}

/** What Caddy forwards a Caddyfile address to, as far as its running config says. */
function targetOf(
  running: Awaited<ReturnType<typeof loadRunningSites>> | null,
  address: string,
): string | null {
  if (running?.state !== "ok") return null;
  const host = address.replace(/^[a-z]+:\/\//i, "").replace(/:\d+$/, "");
  const site = running.sites.find(
    (candidate) =>
      candidate.source.kind === "manual" && candidate.hosts.includes(host),
  );
  const target = site?.targets[0];
  if (!target) return null;
  switch (target.kind) {
    case "proxy":
      return target.upstreams.join(", ");
    case "redirect":
      return target.location;
    case "files":
      return target.root;
    case "respond":
      return String(target.status);
  }
}

const APPLY_STATES = new Set<ApplyOutcome["state"]>([
  "applied",
  "failed",
  "pending",
  "recovery-required",
  "not-configured",
]);

/**
 * Message after a redirect from the form: what was saved and what Caddy did
 * with it. Only for valid hostnames, so a crafted link cannot show arbitrary text.
 */
function noticeOf(
  t: Messages,
  params: Record<string, string | string[] | undefined>,
): { text: string; tone: Tone } | null {
  const { notice, site, apply } = params;
  if (notice !== "created" && notice !== "updated") return null;
  if (typeof site !== "string") return null;
  const hostname = parseSiteHostname(site);
  if (!hostname.ok) return null;
  const saved = t.config.notices[notice](hostname.value);
  if (typeof apply !== "string" || !APPLY_STATES.has(apply as never)) {
    return { text: saved, tone: "success" };
  }
  const outcome = applySentence(t, { state: apply as ApplyOutcome["state"] });
  return { text: `${saved} ${outcome.text}`, tone: outcome.tone };
}

/** "Klassisch" is the page as on main; "Schaltplan" is the redesign. */
export default async function ConfigPage(props: PageProps<"/config">) {
  if ((await getDesign()) === "classic") return ClassicConfigPage(props);
  return SchematicConfigPage(props);
}
