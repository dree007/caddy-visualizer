import {
  FilePenLine,
  FileText,
  type LucideIcon,
  Plus,
  Waypoints,
} from "lucide-react";
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
import { listRevisions } from "@/modules/caddy/revisions";
import { loadSyncStatus } from "@/modules/caddy/sync-status";
import { requireSession } from "@/server/auth/session";
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
import { type SiteListItem, SiteList } from "./site-list";
import { applySentence, type Tone } from "./sync-labels";
import { SyncStatusPanel } from "./sync-status-panel";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.config.title };
}

const HISTORY_LENGTH = 10;

export default async function ConfigPage({
  searchParams,
}: PageProps<"/config">) {
  await requireSession();
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
        : { kind: "proxy", url: site.upstream ?? "" },
    tls: site.tls,
    basicAuth: site.basicAuthHash !== null,
    enabled: site.enabled,
    updatedAt: site.updatedAt.toISOString(),
    updatedLabel: formatDateTime(site.updatedAt, locale),
  }));
  const enabledCount = sites.filter((site) => site.enabled).length;
  const caddyfileSites = main === null ? [] : listCaddyfileSites(main);
  const running = configured ? await loadRunningSites() : null;
  const manualCount =
    running?.state === "ok"
      ? running.sites.filter(
          (site) => site.source.kind === "manual" && site.hosts.length > 0,
        ).length
      : null;

  return (
    <div className="flex flex-col gap-6">
      {notice ? <FlashNotice message={notice.text} tone={notice.tone} /> : null}

      <section
        aria-labelledby="sources-heading"
        className="flex flex-col gap-4"
      >
        <div className="min-w-0">
          <h2 id="sources-heading" className="heading text-2xl">
            {c.heading}
          </h2>
          <p className="text-sm text-muted-foreground">{c.intro}</p>
        </div>

        <SyncStatusPanel status={sync} locale={locale} t={t} />

        <div className="grid gap-4 md:grid-cols-2">
          <SourceCard
            icon={FileText}
            title={c.caddyfileCard.title}
            description={c.caddyfileCard.text}
            meta={manualCount === null ? null : c.siteCount(manualCount)}
            href="/config/caddyfile"
            action={c.caddyfileCard.action}
            actionIcon={FilePenLine}
            disabled={!configured}
          />
          <SourceCard
            icon={Waypoints}
            title={c.formCard.title}
            description={c.formCard.text}
            meta={
              sites.length === 0
                ? c.formCard.none
                : c.formCard.count(sites.length, enabledCount)
            }
            href="/config/new"
            action={c.formCard.action}
            actionIcon={Plus}
          />
        </div>
      </section>

      {main !== null && caddyfileSites.length > 0 ? (
        <CaddyfileAccessLog
          sites={caddyfileSites}
          baseSha256={sha256Of(main)}
          snippetDefined={definesAccessLogSnippet(main)}
        />
      ) : null}

      {items.length > 0 ? (
        <section
          aria-labelledby="form-sites-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="form-sites-heading" className="heading text-2xl">
            {c.formSitesHeading}
          </h2>
          <SiteList sites={items} />
          <ConfigPreview preview={preview} sync={sync} locale={locale} t={t} />
        </section>
      ) : null}

      <RevisionHistory
        revisions={revisions}
        active={sync.lastApplied}
        canApply={configured}
        locale={locale}
        t={t}
      />
    </div>
  );
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

function SourceCard({
  icon: Icon,
  title,
  description,
  meta,
  href,
  action,
  actionIcon: ActionIcon,
  disabled = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  meta: string | null;
  href: "/config/caddyfile" | "/config/new";
  action: string;
  actionIcon: LucideIcon;
  disabled?: boolean;
}) {
  return (
    <div className="surface flex flex-col gap-3 p-5 md:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-stone text-foreground shadow-pressed">
          <Icon aria-hidden className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col">
          <h3 className="heading">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {meta ? <p className="text-sm">{meta}</p> : null}
      {disabled ? null : (
        <Button
          asChild
          variant="outline"
          className="mt-auto w-fit max-md:h-11 max-sm:w-full"
        >
          <Link href={href}>
            <ActionIcon aria-hidden data-icon="inline-start" />
            {action}
          </Link>
        </Button>
      )}
    </div>
  );
}
