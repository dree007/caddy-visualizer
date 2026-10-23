import type { ReactNode } from "react";

import { type Locale, type Messages, translateCode } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import type { SyncStatus } from "@/modules/caddy/sync-status";

import { SyncActions } from "./sync-actions";
import {
  SYNC_TONES,
  TONE_BORDERS,
  TONE_CLASSES,
  TONE_ICONS,
} from "./sync-labels";

/**
 * Desired state (stored configuration) vs. applied state (what Caddy was last
 * verified to run). Rendered from the database; it never contacts Caddy itself.
 */
export function SyncStatusPanel({
  status,
  locale,
  t,
}: {
  status: SyncStatus;
  locale: Locale;
  t: Messages;
}) {
  const d = t.config.syncDetail;
  const { state, latest, lastApplied } = status;
  const title = t.config.sync[state];
  const tone = SYNC_TONES[state];
  const Icon = TONE_ICONS[tone];
  const stored = (fallback: string) =>
    latest?.errorMessage ? translateCode(t, latest.errorMessage) : fallback;

  const appliedLine = lastApplied
    ? d.appliedLine(
        lastApplied.number,
        lastApplied.appliedAt
          ? formatDateTime(lastApplied.appliedAt, locale)
          : null,
      )
    : d.noneApplied;

  let detail: string;
  let actions: ReactNode = null;
  switch (state) {
    case "synced":
      detail = appliedLine;
      break;
    case "applying":
      detail = d.applying;
      break;
    case "checking":
      detail = d.checking(latest?.number ?? "?");
      actions = <SyncActions recheck />;
      break;
    case "recovery-required":
      detail = `${stored(d.unclear)} ${appliedLine}`;
      actions = <SyncActions recheck retry retryLabel={d.applyAgain} />;
      break;
    case "failed":
      detail = `${stored(d.notTaken)} ${appliedLine}`;
      actions = <SyncActions retry />;
      break;
    case "out-of-sync":
      detail = `${d.outOfSync} ${appliedLine}`;
      actions = <SyncActions retry retryLabel={d.applyNow} />;
      break;
    case "idle":
      detail = d.idle;
      break;
    case "other-instance":
      detail = d.otherInstance;
      break;
    case "lock-unavailable":
      detail = d.lockUnavailable;
      break;
    case "not-configured":
      detail = d.notConfigured;
      break;
  }

  return (
    <section
      aria-labelledby="sync-heading"
      aria-busy={tone === "progress" || undefined}
      className={`surface flex flex-col gap-3 p-5 ${TONE_BORDERS[tone]}`}
    >
      <div className="flex items-start gap-3">
        <Icon
          aria-hidden
          className={`mt-0.5 size-5 shrink-0 ${TONE_CLASSES[tone]} ${state === "applying" ? "animate-spin" : ""}`}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="sync-heading" className="font-medium">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{detail}</p>
        </div>
      </div>
      {actions ? <div className="sm:pl-8">{actions}</div> : null}
    </section>
  );
}
