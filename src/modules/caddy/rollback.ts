import { z } from "zod";

import type { Db } from "@/server/db/client";

import { code } from "@/i18n/codes";

import { validateSiteConfig } from "./contracts";
import { type GeneratedSitesCaddy, generateSitesCaddy } from "./generator";
import { definesAccessLogSnippet } from "./main-caddyfile";
import { type ConfigRevision, insertRevision, snapshotOf } from "./revisions";
import { caddySites } from "./schema";
import type { ManagedSite } from "./sites";

const snapshotSchema = z.array(
  z.object({
    id: z.uuid(),
    hostname: z.string(),
    upstream: z.string(),
    tls: z.string(),
    enabled: z.boolean(),
    basicAuthUsername: z.string().nullable().optional(),
    basicAuthHash: z.string().nullable().optional(),
    createdAt: z.iso.datetime().optional(),
    updatedAt: z.string(),
  }),
);

export type SnapshotRestore =
  | {
      ok: true;
      revision: ConfigRevision;
      generated: GeneratedSitesCaddy;
    }
  | { ok: false; message: string };

const INVALID_SNAPSHOT = code("rollback.invalidSnapshot");

/**
 * Makes the sites snapshot of `source` the desired state again and records the
 * `rollback` revision for it, in one transaction: either both happen or
 * neither. `mainContent` is the main Caddyfile the new revision brings Caddy
 * to (the source's snapshot, or the current file for older revisions). The
 * snapshot is fully validated (domain contract, unique host
 * names) before anything is written. Sites keep their IDs; all get a new
 * `updatedAt`, so editors opened before the rollback detect the change.
 */
export function restoreRevisionSnapshot(
  db: Db,
  source: ConfigRevision,
  now: Date,
  mainContent: string | null,
): SnapshotRestore {
  let parsed: z.infer<typeof snapshotSchema>;
  try {
    const result = snapshotSchema.safeParse(JSON.parse(source.sitesSnapshot));
    if (!result.success) return { ok: false, message: INVALID_SNAPSHOT };
    parsed = result.data;
  } catch {
    return { ok: false, message: INVALID_SNAPSHOT };
  }

  const hostnames = new Set<string>();
  const sites: Omit<ManagedSite, "createdAt">[] = [];
  const createdAtOf = new Map<string, Date>();
  for (const entry of parsed) {
    const valid = validateSiteConfig(entry);
    if (!valid.ok || hostnames.has(valid.value.hostname)) {
      return { ok: false, message: INVALID_SNAPSHOT };
    }
    hostnames.add(valid.value.hostname);
    sites.push({ id: entry.id, ...valid.value, updatedAt: now });
    if (entry.createdAt) createdAtOf.set(entry.id, new Date(entry.createdAt));
  }

  return db.transaction((tx) => {
    for (const row of tx
      .select({ id: caddySites.id, createdAt: caddySites.createdAt })
      .from(caddySites)
      .all()) {
      if (!createdAtOf.has(row.id)) createdAtOf.set(row.id, row.createdAt);
    }
    const rows: ManagedSite[] = sites.map((site) => ({
      ...site,
      createdAt: createdAtOf.get(site.id) ?? now,
    }));
    const generated = generateSitesCaddy(rows, {
      accessLog: mainContent !== null && definesAccessLogSnippet(mainContent),
    });

    tx.delete(caddySites).run();
    if (rows.length > 0) tx.insert(caddySites).values(rows).run();
    const revision = insertRevision(
      tx,
      {
        trigger: "rollback",
        configContent: generated.content,
        configSha256: generated.sha256,
        sitesSnapshot: snapshotOf(rows),
        mainContent,
        sourceRevisionId: source.id,
      },
      now,
    );
    return { ok: true, revision, generated } as const;
  });
}
