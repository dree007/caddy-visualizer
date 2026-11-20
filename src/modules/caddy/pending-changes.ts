import type { SiteSnapshot } from "./revisions";
import type { ManagedSite } from "./sites";

export type PendingChangeKind =
  /** In `sites.caddy` now, but not in the last applied revision. */
  | "added"
  /** In the last applied revision, gone from the stored sites. */
  | "removed"
  /** Enabled in the stored sites, disabled (or absent) when last applied. */
  | "enabled"
  /** Disabled in the stored sites, enabled when last applied. */
  | "disabled"
  /** Enabled in both, with different settings. */
  | "changed";

export interface PendingChange {
  kind: PendingChangeKind;
  hostname: string;
}

/** The parts of a site that end up in `sites.caddy`. */
function fingerprint(site: SiteSnapshot | ManagedSite): string {
  return JSON.stringify([
    site.hostname,
    site.kind ?? "proxy",
    site.upstream,
    site.loadBalancing ?? null,
    site.upstreamSkipTlsVerify ?? false,
    site.upstreamHeaders ?? [],
    site.redirectTarget ?? null,
    site.redirectCode ?? null,
    site.tls,
    site.basicAuthUsername ?? null,
    site.basicAuthHash ?? null,
    site.rateLimitRules ?? [],
  ]);
}

/**
 * What the stored sites would change in Caddy compared with the last applied
 * revision ("Vorgemerkt"): a pure comparison of the two site lists, no new
 * state. Without a snapshot (nothing applied yet) every enabled site is new.
 */
export function pendingChanges(
  applied: readonly SiteSnapshot[] | null,
  current: readonly ManagedSite[],
): PendingChange[] {
  const before = new Map((applied ?? []).map((site) => [site.id, site]));
  const changes: PendingChange[] = [];

  for (const site of current) {
    const previous = before.get(site.id);
    before.delete(site.id);
    const wasLive = previous?.enabled === true;
    if (site.enabled && !previous) {
      changes.push({ kind: "added", hostname: site.hostname });
    } else if (site.enabled && !wasLive) {
      changes.push({ kind: "enabled", hostname: site.hostname });
    } else if (!site.enabled && wasLive) {
      changes.push({ kind: "disabled", hostname: site.hostname });
    } else if (
      site.enabled &&
      previous &&
      fingerprint(previous) !== fingerprint(site)
    ) {
      changes.push({ kind: "changed", hostname: site.hostname });
    }
  }
  for (const gone of before.values()) {
    if (gone.enabled)
      changes.push({ kind: "removed", hostname: gone.hostname });
  }
  return changes;
}

/** A revision's stored snapshot; null when it cannot be read. */
export function parseSnapshot(json: string): SiteSnapshot[] | null {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? (value as SiteSnapshot[]) : null;
  } catch {
    return null;
  }
}
