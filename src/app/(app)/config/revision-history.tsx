import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { type Locale, type Messages, translateCode } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import {
  type ConfigRevision,
  sameContent,
  type SiteSnapshot,
} from "@/modules/caddy/revisions";

import { RollbackButton } from "./rollback-button";
import { REVISION_TONES, TONE_CLASSES } from "./sync-labels";

/**
 * Newest revisions with their outcome. A revision that was applied once can be
 * restored: that creates a new revision with its exact content.
 */
export function RevisionHistory({
  revisions,
  active,
  canApply,
  locale,
  t,
}: {
  revisions: ConfigRevision[];
  /** Revision Caddy was last verified to run: restoring identical content is pointless. */
  active: ConfigRevision | null;
  canApply: boolean;
  locale: Locale;
  t: Messages;
}) {
  if (revisions.length === 0) return null;
  const h = t.config.history;
  const byId = new Map(revisions.map((revision) => [revision.id, revision]));

  return (
    <details className="group surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-3xl px-5 py-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:px-7 [&::-webkit-details-marker]:hidden">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-stone text-foreground shadow-pressed">
          <History aria-hidden className="size-4" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="heading">{h.heading}</span>
          <span className="text-sm text-muted-foreground">
            {h.text(revisions.length)}
          </span>
        </span>
        <span
          aria-hidden
          className="ml-auto text-muted-foreground transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>

      <ol className="flex flex-col border-t">
        {revisions.map((revision) => {
          const status = {
            label: t.config.revisionStatus[revision.status],
            tone: REVISION_TONES[revision.status],
          };
          const source = revision.sourceRevisionId
            ? byId.get(revision.sourceRevisionId)
            : undefined;
          const isActive = revision.id === active?.id;
          return (
            <li
              key={revision.id}
              className="flex flex-col gap-2 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4 md:px-5"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-mono font-medium">
                    #{revision.number}
                  </span>
                  <span>
                    {t.config.triggers[revision.trigger] ?? revision.trigger}
                    {revision.trigger === "rollback" && source
                      ? h.rollbackTo(source.number)
                      : ""}
                  </span>
                  <Badge
                    variant="outline"
                    className={TONE_CLASSES[status.tone]}
                  >
                    {status.label}
                  </Badge>
                  {isActive ? (
                    <Badge variant="secondary">{h.lastApplied}</Badge>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  <time dateTime={revision.createdAt.toISOString()}>
                    {formatDateTime(revision.createdAt, locale)}
                  </time>
                  {" · SHA-256 "}
                  <span className="font-mono">
                    {revision.configSha256.slice(0, 12)}
                  </span>
                </p>
                {revision.errorMessage ? (
                  <p className="text-sm text-muted-foreground">
                    {translateCode(t, revision.errorMessage)}
                  </p>
                ) : null}
              </div>
              {canApply &&
              revision.status === "applied" &&
              !(active && sameContent(revision, active)) ? (
                <RollbackButton
                  revisionId={revision.id}
                  revisionNumber={revision.number}
                  createdLabel={formatDateTime(revision.createdAt, locale)}
                  sites={snapshotSites(revision)}
                  restoresMain={revision.mainContent !== null}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

/** Host names and states for the confirmation dialog (no config text). */
function snapshotSites(
  revision: ConfigRevision,
): { hostname: string; enabled: boolean }[] {
  try {
    return (JSON.parse(revision.sitesSnapshot) as SiteSnapshot[]).map(
      ({ hostname, enabled }) => ({ hostname, enabled }),
    );
  } catch {
    return [];
  }
}
