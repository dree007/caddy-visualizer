import "server-only";

import { eq } from "drizzle-orm";

import {
  knownHosts,
  type LogQuery,
  loadMetrics,
  loadUpstreamMetrics,
  type Range,
  recentEntries,
} from "@/modules/access-log/queries";
import { ingestionCursors } from "@/modules/access-log/schema";
import { dialAddress } from "@/modules/caddy/load-balancing";
import { caddySites } from "@/modules/caddy/schema";
import { loadUpstreamHealth } from "@/server/caddy/admin";
import { requireAccess } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";

import { ingestionStatus } from "./ingestion";

/** Session-checked read access for the metrics, logs and dashboard pages. */

export async function loadTrafficMetrics(range: Range, host?: string) {
  await requireAccess();
  const db = getDb();
  return { metrics: loadMetrics(db, { range, host }), hosts: knownHosts(db) };
}

/**
 * Traffic distribution of one host over its upstreams: measured counts from
 * the access log, the configured backends of its load-balanced form site (if
 * any) and Caddy's current health view. `null` when there is nothing to show.
 */
export async function loadUpstreamDistribution(range: Range, host: string) {
  await requireAccess();
  const db = getDb();
  const site = db
    .select({ loadBalancing: caddySites.loadBalancing })
    .from(caddySites)
    .where(eq(caddySites.hostname, host))
    .get();
  const lb = site?.loadBalancing ?? null;
  const metrics = loadUpstreamMetrics(db, { range, host });
  if (!lb && metrics.proxied + metrics.notProxied === 0) return null;
  return {
    metrics,
    configured: lb
      ? {
          policy: lb.policy,
          backends: lb.backends.map((backend) => ({
            ...backend,
            dial: dialAddress(backend.upstream),
          })),
        }
      : null,
    health: lb ? await loadUpstreamHealth() : null,
  };
}

export type UpstreamDistribution = NonNullable<
  Awaited<ReturnType<typeof loadUpstreamDistribution>>
>;

export async function loadLogEntries(query: LogQuery) {
  await requireAccess();
  const db = getDb();
  return { entries: recentEntries(db, query), hosts: knownHosts(db) };
}

/** In-memory state of the reader plus the persisted cursor counters. */
export async function loadIngestionStatus() {
  await requireAccess();
  const env = getEnv();
  const path = env.CADDY_ACCESS_LOG_FILE;
  const cursor =
    getDb()
      .select()
      .from(ingestionCursors)
      .where(eq(ingestionCursors.path, path))
      .get() ?? null;
  return {
    path,
    managedDir: env.CADDY_MANAGED_DIR,
    runtime: ingestionStatus(),
    cursor,
  };
}
