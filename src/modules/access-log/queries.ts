import { and, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";

import type { Db } from "@/server/db/client";

import { accessLogEntries, trafficHourly } from "./schema";

export const RANGES = ["24h", "7d", "30d"] as const;
export type Range = (typeof RANGES)[number];

export const STATUS_CLASSES = ["2xx", "3xx", "4xx", "5xx"] as const;
export type StatusClass = (typeof STATUS_CLASSES)[number];

export interface MetricsTotals {
  requests: number;
  bytes: number;
  /** Mean over all requests; null without requests. */
  avgMs: number | null;
  maxMs: number | null;
  byClass: Record<StatusClass, number>;
}

export interface SeriesPoint {
  /** Start of the bucket (epoch ms). */
  start: number;
  /** Local hour ("14") or date ("2026-10-19") of the bucket. */
  label: string;
  requests: number;
  errors: number;
  byClass: Record<StatusClass, number>;
}

/** One status code: its total and one value per series bucket. */
export interface CodeRow {
  status: number;
  requests: number;
  series: number[];
}

export interface HostRow {
  host: string;
  requests: number;
  bytes: number;
  errors: number;
  avgMs: number | null;
}

export interface Metrics {
  range: Range;
  totals: MetricsTotals;
  /**
   * The period before, of the same length and up to the same point in time
   * (e.g. yesterday 00:00 to 12:30 against today 00:00 to 12:30), so a running
   * hour or day does not make the current numbers look smaller.
   */
  previous: { totals: MetricsTotals; hosts: HostRow[] };
  series: SeriesPoint[];
  /** Every status code in the range, most frequent first. */
  codes: CodeRow[];
  hosts: HostRow[];
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Everything a metrics view shows, from the hourly rollups. */
export function loadMetrics(
  db: Db,
  {
    range,
    host,
    now = new Date(),
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  }: { range: Range; host?: string; now?: Date; timeZone?: string },
): Metrics {
  const buckets = bucketsOf(range, now, timeZone);
  const from = buckets[0]!.start;
  const rowsBetween = (start: number, end?: number) =>
    db
      .select()
      .from(trafficHourly)
      .where(
        and(
          gte(trafficHourly.bucketStart, start),
          end === undefined ? undefined : lt(trafficHourly.bucketStart, end),
          host ? eq(trafficHourly.host, host) : undefined,
        ),
      )
      .all();
  const rows = rowsBetween(from);
  const span = SPANS[range];
  const previous = summarize(rowsBetween(from - span, now.getTime() - span));

  const { totals, hosts } = summarize(rows);
  const points: SeriesPoint[] = buckets.map((bucket) => ({
    ...bucket,
    requests: 0,
    errors: 0,
    byClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 },
  }));
  const indexOf = bucketIndex(points, range);
  const codes = new Map<number, CodeRow>();

  for (const row of rows) {
    const statusClass = classOf(row.status);
    const errors = row.status >= 500 ? row.requests : 0;
    const index = indexOf(row.bucketStart);
    const point = points[index];
    if (point) {
      point.requests += row.requests;
      point.errors += errors;
      if (statusClass) point.byClass[statusClass] += row.requests;
    }
    let code = codes.get(row.status);
    if (!code) {
      code = {
        status: row.status,
        requests: 0,
        series: points.map(() => 0),
      };
      codes.set(row.status, code);
    }
    code.requests += row.requests;
    if (point) code.series[index]! += row.requests;
  }

  return {
    range,
    totals,
    previous,
    series: points,
    codes: [...codes.values()].sort(
      (a, b) => b.requests - a.requests || a.status - b.status,
    ),
    hosts,
  };
}

const SPANS: Record<Range, number> = {
  "24h": DAY,
  "7d": 7 * DAY,
  "30d": 30 * DAY,
};

/** Totals and per-host rows of rollup rows. */
function summarize(rows: (typeof trafficHourly.$inferSelect)[]): {
  totals: MetricsTotals;
  hosts: HostRow[];
} {
  const totals: MetricsTotals = {
    requests: 0,
    bytes: 0,
    avgMs: null,
    maxMs: null,
    byClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 },
  };
  let durationSum = 0;
  const hosts = new Map<string, HostRow & { durationSum: number }>();
  for (const row of rows) {
    totals.requests += row.requests;
    totals.bytes += row.bytesOut;
    durationSum += row.durationMsSum;
    totals.maxMs = Math.max(totals.maxMs ?? 0, row.durationMsMax);
    const statusClass = classOf(row.status);
    if (statusClass) totals.byClass[statusClass] += row.requests;
    const entry = hosts.get(row.host) ?? {
      host: row.host,
      requests: 0,
      bytes: 0,
      errors: 0,
      avgMs: null,
      durationSum: 0,
    };
    entry.requests += row.requests;
    entry.bytes += row.bytesOut;
    entry.errors += row.status >= 500 ? row.requests : 0;
    entry.durationSum += row.durationMsSum;
    hosts.set(row.host, entry);
  }
  if (totals.requests > 0) totals.avgMs = durationSum / totals.requests;
  return {
    totals,
    hosts: [...hosts.values()]
      .map(({ durationSum: sum, ...row }) => ({
        ...row,
        avgMs: row.requests > 0 ? sum / row.requests : null,
      }))
      .sort((a, b) => b.requests - a.requests || a.host.localeCompare(b.host)),
  };
}

/** Host names with traffic in the last 30 days, for the filter. */
export function knownHosts(db: Db, now: Date = new Date()): string[] {
  return db
    .selectDistinct({ host: trafficHourly.host })
    .from(trafficHourly)
    .where(gte(trafficHourly.bucketStart, now.getTime() - 31 * DAY))
    .orderBy(trafficHourly.host)
    .all()
    .map((row) => row.host);
}

export interface LogQuery {
  host?: string;
  statusClass?: StatusClass;
  /** Substring of the path. */
  path?: string;
  /** Only entries older than this id (paging). */
  beforeId?: number;
  limit?: number;
}

/** Newest first. */
export function recentEntries(db: Db, query: LogQuery = {}) {
  const conditions: (SQL | undefined)[] = [
    query.host ? eq(accessLogEntries.host, query.host) : undefined,
    query.beforeId ? lt(accessLogEntries.id, query.beforeId) : undefined,
    query.path
      ? sql`${accessLogEntries.path} like ${`%${escapeLike(query.path)}%`} escape '\\'`
      : undefined,
  ];
  if (query.statusClass) {
    const base = Number(query.statusClass[0]) * 100;
    conditions.push(
      gte(accessLogEntries.status, base),
      lt(accessLogEntries.status, base + 100),
    );
  }
  return db
    .select()
    .from(accessLogEntries)
    .where(and(...conditions))
    .orderBy(desc(accessLogEntries.id))
    .limit(query.limit ?? 100)
    .all();
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function classOf(status: number): StatusClass | null {
  const digit = Math.floor(status / 100);
  return digit >= 2 && digit <= 5 ? (`${digit}xx` as StatusClass) : null;
}

/**
 * 24 h: the last 24 hours (current one included). 7/30 d: that many calendar
 * days in `timeZone`, today included; each day starts at its local midnight.
 */
function bucketsOf(
  range: Range,
  now: Date,
  timeZone: string,
): { start: number; label: string }[] {
  if (range === "24h") {
    const current = Math.floor(now.getTime() / HOUR) * HOUR;
    const hour = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    });
    return Array.from({ length: 24 }, (_, i) => {
      const start = current - (23 - i) * HOUR;
      return { start, label: hour.format(start) };
    });
  }
  const days = range === "7d" ? 7 : 30;
  const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone });
  const buckets: { start: number; label: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const label = dateKey.format(now.getTime() - i * DAY);
    if (buckets.at(-1)?.label !== label) {
      buckets.push({ start: localMidnight(label, timeZone), label });
    }
  }
  return buckets;
}

/** Epoch ms of 00:00 of `date` (YYYY-MM-DD) in `timeZone`. */
function localMidnight(date: string, timeZone: string): number {
  const utc = Date.parse(`${date}T00:00:00Z`);
  // Offset of the zone at that moment, e.g. +2 h for Europe/Berlin in summer.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(utc);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const local = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
  );
  return utc - (local - utc);
}

function bucketIndex(
  points: { start: number }[],
  range: Range,
): (bucketStart: number) => number {
  if (range === "24h") {
    const first = points[0]!.start;
    return (start) => Math.floor((start - first) / HOUR);
  }
  return (start) => {
    for (let i = points.length - 1; i >= 0; i--) {
      if (start >= points[i]!.start) return i;
    }
    return -1;
  };
}
