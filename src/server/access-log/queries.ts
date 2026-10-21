import "server-only";

import { eq } from "drizzle-orm";

import {
  knownHosts,
  type LogQuery,
  loadMetrics,
  type Range,
  recentEntries,
} from "@/modules/access-log/queries";
import { ingestionCursors } from "@/modules/access-log/schema";
import { requireSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";

import { ingestionStatus } from "./ingestion";

/** Session-checked read access for the metrics, logs and dashboard pages. */

export async function loadTrafficMetrics(range: Range, host?: string) {
  await requireSession();
  const db = getDb();
  return { metrics: loadMetrics(db, { range, host }), hosts: knownHosts(db) };
}

export async function loadLogEntries(query: LogQuery) {
  await requireSession();
  const db = getDb();
  return { entries: recentEntries(db, query), hosts: knownHosts(db) };
}

/** In-memory state of the reader plus the persisted cursor counters. */
export async function loadIngestionStatus() {
  await requireSession();
  const path = getEnv().CADDY_ACCESS_LOG_FILE;
  const cursor =
    getDb()
      .select()
      .from(ingestionCursors)
      .where(eq(ingestionCursors.path, path))
      .get() ?? null;
  return { path, runtime: ingestionStatus(), cursor };
}
