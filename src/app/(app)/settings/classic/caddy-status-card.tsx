import { CircleAlert, CircleCheck, CircleDashed, Server } from "lucide-react";

import { translateCode } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { formatDateTime } from "@/lib/format";
import { lastAppliedRevision } from "@/modules/caddy/revisions";
import { checkCaddyRuntime } from "@/server/caddy/admin";
import { getDb } from "@/server/db";

/**
 * Live status of the Caddy connection (one read-only `GET /config/` on the
 * server). The Caddy version is not shown: the admin API has no endpoint for
 * it, and the image tag is no reliable source.
 */
export async function CaddyStatusCard() {
  const [runtime, { locale, t }] = await Promise.all([
    checkCaddyRuntime(),
    getI18n(),
  ]);
  const c = t.settings.caddy;
  const applied = lastAppliedRevision(getDb());

  const connection =
    runtime.state === "connected"
      ? {
          icon: CircleCheck,
          tone: "text-emerald-600 dark:text-emerald-400",
          text: c.connected,
        }
      : runtime.state === "unreachable"
        ? {
            icon: CircleAlert,
            tone: "text-destructive",
            text: translateCode(t, runtime.message),
          }
        : {
            icon: CircleDashed,
            tone: "text-muted-foreground",
            text: c.notConfigured,
          };
  const Icon = connection.icon;

  let running: string | null = null;
  if (runtime.state === "connected" && runtime.matchesLastApplied !== null) {
    const number = runtime.lastApplied?.number ?? 0;
    running = runtime.matchesLastApplied
      ? c.matches(number)
      : c.differs(number);
  }

  return (
    <section
      aria-labelledby="caddy-status-heading"
      className="surface flex flex-col gap-4 p-5 md:p-7"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-stone text-foreground shadow-pressed">
          <Server aria-hidden className="size-4" />
        </span>
        <h2 id="caddy-status-heading" className="heading">
          {c.heading}
        </h2>
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-muted-foreground">{c.connection}</dt>
        <dd className={`flex items-start gap-1.5 ${connection.tone}`}>
          <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
          {connection.text}
        </dd>
        <dt className="text-muted-foreground">{c.lastSync}</dt>
        <dd>
          {applied?.appliedAt
            ? formatDateTime(applied.appliedAt, locale)
            : t.common.none}
        </dd>
        <dt className="text-muted-foreground">{c.lastRevision}</dt>
        <dd>{applied ? `#${applied.number}` : "–"}</dd>
        {running ? (
          <>
            <dt className="text-muted-foreground">{c.running}</dt>
            <dd>{running}</dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}
