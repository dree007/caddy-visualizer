import { createHash } from "node:crypto";
import { open, readdir, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { eq, lt, sql } from "drizzle-orm";

import type { Db } from "@/server/db/client";

import { type AccessLogEntry, parseAccessLogLine } from "./parser";
import { accessLogEntries, ingestionCursors, trafficHourly } from "./schema";

/*
 * Incremental, exactly-once ingestion of Caddy's access log (ARCHITECTURE.md
 * 6.3). Entries, hourly rollups and the new cursor offset of a batch are
 * written in one transaction, so a crash re-reads from the last commit and
 * never counts twice. Rotation (Caddy renames the file, same inode, then
 * starts a new one) is followed via inode and the first line's hash.
 */

export const ENTRY_RETENTION_MS = 14 * 24 * 3600_000;
export const ROLLUP_RETENTION_MS = 396 * 24 * 3600_000;
const HOUR_MS = 3600_000;
const BATCH_LINES = 1000;
const CHUNK_BYTES = 1024 * 1024;
/** Per run; the rest follows in the next one. */
const MAX_BYTES_PER_RUN = 32 * 1024 * 1024;

export interface IngestResult {
  state: "missing" | "ok";
  stored: number;
  skipped: number;
  /** The previous file was rotated away; true also when it was gone (gap). */
  rotated: boolean;
  gap: boolean;
}

interface FileIdentity {
  dev: number;
  ino: number;
  fingerprint: string | null;
}

export async function ingestOnce(
  db: Db,
  path: string,
  now: Date = new Date(),
): Promise<IngestResult> {
  const result: IngestResult = {
    state: "ok",
    stored: 0,
    skipped: 0,
    rotated: false,
    gap: false,
  };
  let current;
  try {
    current = await stat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...result, state: "missing" };
    }
    throw error;
  }
  const identity: FileIdentity = {
    dev: current.dev,
    ino: current.ino,
    fingerprint: await fingerprintOf(path),
  };
  const budget = { bytes: MAX_BYTES_PER_RUN };
  const cursor = db
    .select()
    .from(ingestionCursors)
    .where(eq(ingestionCursors.path, path))
    .get();

  if (!cursor) {
    await readFrom(db, path, path, identity, 0, now, result, budget);
    return result;
  }
  const sameFile =
    cursor.dev === identity.dev &&
    cursor.ino === identity.ino &&
    current.size >= cursor.offset &&
    (cursor.fingerprint === null ||
      cursor.fingerprint === identity.fingerprint);
  if (sameFile) {
    await readFrom(
      db,
      path,
      path,
      identity,
      cursor.offset,
      now,
      result,
      budget,
    );
    return result;
  }

  result.rotated = true;
  const old = await findRotated(path, cursor);
  if (old) {
    const done = await readFrom(
      db,
      path,
      old,
      { dev: cursor.dev, ino: cursor.ino, fingerprint: cursor.fingerprint },
      cursor.offset,
      now,
      result,
      budget,
    );
    // Not finished within this run's budget: continue there next time.
    if (!done) return result;
  } else {
    result.gap = true;
  }
  db.update(ingestionCursors)
    .set({
      ...identity,
      offset: 0,
      gaps: sql`${ingestionCursors.gaps} + ${result.gap ? 1 : 0}`,
      updatedAt: now,
    })
    .where(eq(ingestionCursors.path, path))
    .run();
  await readFrom(db, path, path, identity, 0, now, result, budget);
  return result;
}

/** Deletes entries and rollups past their retention, in small batches. */
export function pruneAccessLog(db: Db, now: Date = new Date()): number {
  const entryCutoff = now.getTime() - ENTRY_RETENTION_MS;
  let deleted = 0;
  for (;;) {
    const { changes } = db.run(
      sql`delete from ${accessLogEntries} where ${accessLogEntries.id} in (select ${accessLogEntries.id} from ${accessLogEntries} where ${accessLogEntries.ts} < ${entryCutoff} limit 5000)`,
    );
    deleted += changes;
    if (changes < 5000) break;
  }
  db.delete(trafficHourly)
    .where(lt(trafficHourly.bucketStart, now.getTime() - ROLLUP_RETENTION_MS))
    .run();
  return deleted;
}

/**
 * Reads complete lines of `file` from `offset` and commits them batch by
 * batch together with the cursor (stored under `cursorPath`). True if it
 * reached the end of the file.
 */
async function readFrom(
  db: Db,
  cursorPath: string,
  file: string,
  identity: FileIdentity,
  offset: number,
  now: Date,
  result: IngestResult,
  budget: { bytes: number },
): Promise<boolean> {
  const handle = await open(file, "r");
  try {
    let position = offset;
    let pending = Buffer.alloc(0);
    let lines: string[] = [];
    let consumed = 0;
    const chunk = Buffer.alloc(CHUNK_BYTES);
    const commit = () => {
      position = commitBatch(
        db,
        cursorPath,
        identity,
        position,
        consumed,
        lines,
        now,
        result,
      );
      lines = [];
      consumed = 0;
    };
    if (offset === 0) commitCursor(db, cursorPath, identity, 0, 0, now);
    for (;;) {
      if (budget.bytes <= 0) {
        if (lines.length > 0) commit();
        return false;
      }
      const { bytesRead } = await handle.read(
        chunk,
        0,
        Math.min(CHUNK_BYTES, budget.bytes),
        position + consumed + pending.length,
      );
      if (bytesRead === 0) break;
      budget.bytes -= bytesRead;
      pending = Buffer.concat([pending, chunk.subarray(0, bytesRead)]);
      let newline: number;
      while ((newline = pending.indexOf(0x0a)) >= 0) {
        lines.push(pending.subarray(0, newline).toString("utf8"));
        consumed += newline + 1;
        pending = pending.subarray(newline + 1);
        if (lines.length >= BATCH_LINES) commit();
      }
    }
    if (lines.length > 0) commit();
    return true;
  } finally {
    await handle.close();
  }
}

function commitBatch(
  db: Db,
  cursorPath: string,
  identity: FileIdentity,
  position: number,
  consumed: number,
  lines: string[],
  now: Date,
  result: IngestResult,
): number {
  const entryCutoff = now.getTime() - ENTRY_RETENTION_MS;
  const rollupCutoff = now.getTime() - ROLLUP_RETENTION_MS;
  const entries: AccessLogEntry[] = [];
  let skipped = 0;
  for (const line of lines) {
    if (line.trim() === "") continue;
    const entry = parseAccessLogLine(line);
    if (entry) entries.push(entry);
    else skipped++;
  }
  const rollups = new Map<string, typeof trafficHourly.$inferInsert>();
  for (const entry of entries) {
    if (entry.ts < rollupCutoff) continue;
    const bucketStart = Math.floor(entry.ts / HOUR_MS) * HOUR_MS;
    const key = `${bucketStart}|${entry.host}|${entry.status}`;
    const rollup = rollups.get(key) ?? {
      bucketStart,
      host: entry.host,
      status: entry.status,
      requests: 0,
      bytesOut: 0,
      durationMsSum: 0,
      durationMsMax: 0,
    };
    rollup.requests! += 1;
    rollup.bytesOut! += entry.bytes;
    rollup.durationMsSum! += entry.durationMs;
    rollup.durationMsMax = Math.max(rollup.durationMsMax!, entry.durationMs);
    rollups.set(key, rollup);
  }
  const recent = entries.filter((entry) => entry.ts >= entryCutoff);
  const next = position + consumed;

  db.transaction((tx) => {
    for (let i = 0; i < recent.length; i += 500) {
      tx.insert(accessLogEntries)
        .values(recent.slice(i, i + 500))
        .run();
    }
    for (const rollup of rollups.values()) {
      tx.insert(trafficHourly)
        .values(rollup)
        .onConflictDoUpdate({
          target: [
            trafficHourly.bucketStart,
            trafficHourly.host,
            trafficHourly.status,
          ],
          set: {
            requests: sql`${trafficHourly.requests} + excluded.requests`,
            bytesOut: sql`${trafficHourly.bytesOut} + excluded.bytes_out`,
            durationMsSum: sql`${trafficHourly.durationMsSum} + excluded.duration_ms_sum`,
            durationMsMax: sql`max(${trafficHourly.durationMsMax}, excluded.duration_ms_max)`,
          },
        })
        .run();
    }
    commitCursor(tx, cursorPath, identity, next, skipped, now);
  });
  result.stored += recent.length;
  result.skipped += skipped;
  return next;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

function commitCursor(
  db: Db | Tx,
  path: string,
  identity: FileIdentity,
  offset: number,
  skipped: number,
  now: Date,
): void {
  db.insert(ingestionCursors)
    .values({
      path,
      ...identity,
      offset,
      linesSkipped: skipped,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: ingestionCursors.path,
      set: {
        ...identity,
        offset,
        linesSkipped: sql`${ingestionCursors.linesSkipped} + ${skipped}`,
        updatedAt: now,
      },
    })
    .run();
}

/** The renamed previous file: same device and inode (and first line). */
async function findRotated(
  path: string,
  cursor: FileIdentity,
): Promise<string | null> {
  const dir = dirname(path);
  for (const name of await readdir(dir).catch(() => [])) {
    if (name === basename(path)) continue;
    const candidate = join(dir, name);
    const info = await stat(candidate).catch(() => null);
    if (!info?.isFile()) continue;
    if (info.dev !== cursor.dev || info.ino !== cursor.ino) continue;
    if (
      cursor.fingerprint !== null &&
      (await fingerprintOf(candidate)) !== cursor.fingerprint
    ) {
      continue;
    }
    return candidate;
  }
  return null;
}

/** SHA-256 of the first complete line; null while there is none. */
async function fingerprintOf(path: string): Promise<string | null> {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const end = buffer.subarray(0, bytesRead).indexOf(0x0a);
    if (end < 0) return null;
    return createHash("sha256").update(buffer.subarray(0, end)).digest("hex");
  } finally {
    await handle.close();
  }
}
