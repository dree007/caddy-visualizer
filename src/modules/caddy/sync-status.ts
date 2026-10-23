import type { Db } from "@/server/db/client";

import { generateSitesCaddy, SiteGeneratorError } from "./generator";
import type { InstanceLockFailure } from "./instance-lock";
import { definesAccessLogSnippet } from "./main-caddyfile";
import {
  type ConfigRevision,
  lastAppliedRevision,
  latestRevision,
  sameContent,
} from "./revisions";
import { listSites } from "./sites";

const EMPTY_SHA256 = generateSitesCaddy([]).sha256;

export type SyncState =
  /** No Caddy admin API configured: changes are only stored. */
  | "not-configured"
  /** The last applied revision equals the current desired state. */
  | "synced"
  /** An apply runs in this process right now. */
  | "applying"
  /** A revision is still `pending`/`loading` without a running apply (e.g. after a restart). */
  | "checking"
  /** The latest attempt failed; Caddy runs the last applied revision. */
  | "failed"
  /** The outcome of the latest attempt is unknown. */
  | "recovery-required"
  /** The desired state was never applied (or differs, e.g. after a rollback). */
  | "out-of-sync"
  /** No managed sites and nothing applied yet: there is nothing to sync. */
  | "idle"
  /** Another manager instance holds the lock; this one does not apply. */
  | "other-instance"
  /** The lock file in the managed directory cannot be used; nothing applies. */
  | "lock-unavailable";

export interface SyncStatus {
  state: SyncState;
  latest: ConfigRevision | null;
  lastApplied: ConfigRevision | null;
  /** SHA-256 of `sites.caddy` generated from the current sites; null if they are invalid. */
  desiredSha256: string | null;
  /** The main Caddyfile on disk; null if unreadable or not checked. */
  desiredMain: string | null;
}

/**
 * Derived from the database only (no Caddy request): it states what the
 * manager last verified, not a live check. Drift caused outside the manager
 * (e.g. a manual reload) is detected separately (live runtime check).
 */
export async function loadSyncStatus(
  db: Db,
  {
    configured,
    applying,
    lockFailure = null,
    readMain,
  }: {
    configured: boolean;
    applying: boolean;
    /** Why this process may not apply (see `InstanceLockFailure`); null if it may. */
    lockFailure?: InstanceLockFailure["reason"] | null;
    /** Reads the main Caddyfile (a local file, not a Caddy request). */
    readMain?: () => Promise<string>;
  },
): Promise<SyncStatus> {
  const latest = latestRevision(db);
  const lastApplied = lastAppliedRevision(db);
  const desiredMain = readMain ? await readMain().catch(() => null) : null;
  let desiredSha256: string | null = null;
  try {
    desiredSha256 = generateSitesCaddy(await listSites(db), {
      accessLog: desiredMain !== null && definesAccessLogSnippet(desiredMain),
    }).sha256;
  } catch (error) {
    if (!(error instanceof SiteGeneratorError)) throw error;
  }
  return {
    state: syncState({
      configured,
      applying,
      lockFailure,
      latest,
      lastApplied,
      desiredSha256,
      desiredMain,
    }),
    latest,
    lastApplied,
    desiredSha256,
    desiredMain,
  };
}

export function syncState({
  configured,
  applying,
  lockFailure = null,
  latest,
  lastApplied,
  desiredSha256,
  desiredMain = null,
}: {
  configured: boolean;
  applying: boolean;
  lockFailure?: InstanceLockFailure["reason"] | null;
  latest: ConfigRevision | null;
  lastApplied: ConfigRevision | null;
  desiredSha256: string | null;
  desiredMain?: string | null;
}): SyncState {
  if (!configured) return "not-configured";
  if (lockFailure === "busy") return "other-instance";
  if (lockFailure === "unavailable") return "lock-unavailable";
  if (applying) return "applying";
  if (latest?.status === "pending" || latest?.status === "loading") {
    return "checking";
  }
  if (latest?.status === "recovery-required") return "recovery-required";
  if (
    lastApplied &&
    desiredSha256 !== null &&
    sameContent(lastApplied, {
      configSha256: desiredSha256,
      mainContent: desiredMain,
    })
  ) {
    return "synced";
  }
  if (latest?.status === "failed") return "failed";
  if (latest === null && desiredSha256 === EMPTY_SHA256) {
    return "idle";
  }
  return "out-of-sync";
}
