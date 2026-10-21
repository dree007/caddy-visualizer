import { ExternalLink, KeyRound, Lock, LockOpen, Pencil } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { SiteTarget } from "@/modules/caddy/site-inventory";
import type { Messages } from "@/i18n";
import { getI18n } from "@/i18n/server";
import type { OverviewSite } from "@/server/caddy/admin";

/** Sites Caddy runs right now, as cards (mobile first). */
export async function RunningSites({ sites }: { sites: OverviewSite[] }) {
  const { t } = await getI18n();
  const r = t.runningSites;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {sites.map((site, index) => (
        <li
          key={`${site.listen.join()}-${site.hosts.join()}-${index}`}
          className="surface flex min-w-0 flex-col gap-2 p-5"
        >
          <div className="flex items-start gap-2">
            <span
              className="mt-0.5 shrink-0 text-muted-foreground"
              title={site.https ? r.https : r.http}
            >
              {site.https ? (
                <Lock aria-label={r.https} className="size-4" />
              ) : (
                <LockOpen aria-label={r.http} className="size-4" />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              {site.hosts.length === 0 ? (
                <span className="font-mono text-sm font-medium">
                  {site.listen.join(", ")}
                </span>
              ) : (
                site.hosts.map((host) => (
                  <HostLink key={host} host={host} https={site.https} />
                ))
              )}
            </div>
            <EditLink site={site} label={r.edit(site.hosts[0] ?? "Site")} />
          </div>

          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {site.targets.length === 0 ? (
              <li>{r.noTarget}</li>
            ) : (
              site.targets.map((target, i) => (
                <li key={i} className="min-w-0 [overflow-wrap:anywhere]">
                  {describe(target, t)}
                </li>
              ))
            )}
          </ul>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">
              {site.source.kind === "form" ? r.form : r.manual}
            </Badge>
            {site.auth ? (
              <Badge variant="secondary">
                <KeyRound aria-hidden data-icon="inline-start" />
                {r.login}
              </Badge>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function HostLink({ host, https }: { host: string; https: boolean }) {
  if (host.includes("*")) {
    return (
      <span className="text-sm font-medium [overflow-wrap:anywhere]">
        {host}
      </span>
    );
  }
  return (
    <a
      href={`${https ? "https" : "http"}://${host}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-8 w-fit items-center gap-1 text-sm font-medium [overflow-wrap:anywhere] hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {host}
      <ExternalLink
        aria-hidden
        className="size-3 shrink-0 text-muted-foreground"
      />
    </a>
  );
}

function EditLink({ site, label }: { site: OverviewSite; label: string }) {
  const href =
    site.source.kind === "form"
      ? (`/config/${site.source.siteId}/edit` as const)
      : ("/config/caddyfile" as const);
  return (
    <Link
      href={href}
      aria-label={label}
      className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:size-8"
    >
      <Pencil aria-hidden className="size-4" />
    </Link>
  );
}

function describe(target: SiteTarget, t: Messages): string {
  const r = t.runningSites;
  switch (target.kind) {
    case "proxy":
      return r.proxy(target.upstreams.join(", "));
    case "files":
      return r.files(target.root);
    case "redirect":
      return r.redirect(target.status, target.location);
    case "respond":
      return r.respond(target.status);
  }
}
