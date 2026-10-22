import { randomUUID } from "node:crypto";

import { desc, eq, inArray, max } from "drizzle-orm";

import type { Db } from "@/server/db/client";

import {
  type ConfigRevisionRow,
  configRevisions,
  type RevisionStatus,
  type RevisionTrigger,
} from "./schema";
import type { ManagedSite } from "./sites";

export type ConfigRevision = ConfigRevisionRow;

/** What a revision was generated from; stored as JSON, never re-derived. */
export interface SiteSnapshot {
  id: string;
  hostname: string;
  /** Missing in snapshots from before redirects (= proxy). */
  kind?: string;
  upstream: string | null;
  redirectTarget?: string | null;
  redirectCode?: number | null;
  tls: string;
  enabled: boolean;
  /** Missing in snapshots from before basic auth; restored by a rollback. */
  basicAuthUsername?: string | null;
  basicAuthHash?: string | null;
  /** Missing in snapshots written before rollbacks restored sites. */
  createdAt?: string;
  updatedAt: string;
}

export function snapshotOf(sites: readonly ManagedSite[]): SiteSnapshot[] {
  return sites.map((site) => ({
    id: site.id,
    hostname: site.hostname,
    kind: site.kind,
    upstream: site.upstream,
    redirectTarget: site.redirectTarget,
    redirectCode: site.redirectCode,
    tls: site.tls,
    enabled: site.enabled,
    basicAuthUsername: site.basicAuthUsername,
    basicAuthHash: site.basicAuthHash,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
  }));
}

/** A transaction handle of the Drizzle database (same query API). */
export type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface NewRevision {
  trigger: RevisionTrigger;
  configContent: string;
  configSha256: string;
  sitesSnapshot: SiteSnapshot[] | string;
  /** Main Caddyfile the revision brings Caddy to; null if unreadable. */
  mainContent?: string | null;
  sourceRevisionId?: string | null;
}

/** Statuses of a revision whose outcome is not settled yet. */
export const UNRESOLVED_STATUSES: readonly RevisionStatus[] = [
  "pending",
  "loading",
  "recovery-required",
];

/** Creates a `pending` revision with the next sequential number. */
export function createRevision(
  db: Db,
  input: NewRevision,
  now: Date = new Date(),
): ConfigRevision {
  return db.transaction((tx) => insertRevision(tx, input, now));
}

/** Like `createRevision`, inside a caller's transaction. */
export function insertRevision(
  tx: DbTransaction,
  input: NewRevision,
  now: Date,
): ConfigRevision {
  const [{ last } = { last: null }] = tx
    .select({ last: max(configRevisions.number) })
    .from(configRevisions)
    .all();
  const revision: ConfigRevision = {
    id: randomUUID(),
    number: (last ?? 0) + 1,
    createdAt: now,
    updatedAt: now,
    trigger: input.trigger,
    sourceRevisionId: input.sourceRevisionId ?? null,
    configContent: input.configContent,
    configSha256: input.configSha256,
    sitesSnapshot:
      typeof input.sitesSnapshot === "string"
        ? input.sitesSnapshot
        : JSON.stringify(input.sitesSnapshot),
    mainContent: input.mainContent ?? null,
    status: "pending",
    expectedConfigFingerprint: null,
    errorMessage: null,
    appliedAt: null,
  };
  tx.insert(configRevisions).values(revision).run();
  return revision;
}

export function getRevision(db: Db, id: string): ConfigRevision | null {
  return (
    db.select().from(configRevisions).where(eq(configRevisions.id, id)).get() ??
    null
  );
}

/** Newest first. */
export function listRevisions(db: Db, limit = 20): ConfigRevision[] {
  return db
    .select()
    .from(configRevisions)
    .orderBy(desc(configRevisions.number))
    .limit(limit)
    .all();
}

export function latestRevision(db: Db): ConfigRevision | null {
  return listRevisions(db, 1)[0] ?? null;
}

/** Whether two revisions bring Caddy to the same managed files. */
export function sameContent(
  a: Pick<ConfigRevision, "configSha256" | "mainContent">,
  b: Pick<ConfigRevision, "configSha256" | "mainContent">,
): boolean {
  // Revisions from before the editor have no snapshot: compare sites only.
  return (
    a.configSha256 === b.configSha256 &&
    (a.mainContent === null ||
      b.mainContent === null ||
      a.mainContent === b.mainContent)
  );
}

/** The revision Caddy was last verified to run (and `sites.caddy` contains). */
export function lastAppliedRevision(db: Db): ConfigRevision | null {
  return (
    db
      .select()
      .from(configRevisions)
      .where(eq(configRevisions.status, "applied"))
      .orderBy(desc(configRevisions.appliedAt), desc(configRevisions.number))
      .limit(1)
      .get() ?? null
  );
}

/** Unsettled revisions other than the given one (oldest first). */
export function otherUnresolvedRevisions(
  db: Db,
  exceptId: string,
): ConfigRevision[] {
  return db
    .select()
    .from(configRevisions)
    .where(inArray(configRevisions.status, [...UNRESOLVED_STATUSES]))
    .all()
    .filter((revision) => revision.id !== exceptId)
    .sort((a, b) => a.number - b.number);
}

export function markLoading(
  db: Db,
  id: string,
  expectedConfigFingerprint: string,
  now: Date = new Date(),
): void {
  update(db, id, {
    status: "loading",
    expectedConfigFingerprint,
    errorMessage: null,
    updatedAt: now,
  });
}

export function markApplied(db: Db, id: string, now: Date = new Date()): void {
  update(db, id, {
    status: "applied",
    errorMessage: null,
    appliedAt: now,
    updatedAt: now,
  });
}

export function markFailed(
  db: Db,
  id: string,
  errorMessage: string,
  now: Date = new Date(),
): void {
  update(db, id, { status: "failed", errorMessage, updatedAt: now });
}

export function markRecoveryRequired(
  db: Db,
  id: string,
  errorMessage: string,
  now: Date = new Date(),
): void {
  update(db, id, {
    status: "recovery-required",
    errorMessage,
    updatedAt: now,
  });
}

function update(
  db: Db,
  id: string,
  values: Partial<Omit<ConfigRevision, "id" | "number">>,
): void {
  db.update(configRevisions)
    .set(values)
    .where(eq(configRevisions.id, id))
    .run();
}
