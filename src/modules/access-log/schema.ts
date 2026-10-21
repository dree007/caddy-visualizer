import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/**
 * Requests from Caddy's access log, reduced to the fields of ARCHITECTURE.md
 * 6.4: no client IP, query string, headers or user agent. Kept 14 days.
 */
export const accessLogEntries = sqliteTable(
  "access_log_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Epoch milliseconds (UTC). */
    ts: integer("ts").notNull(),
    host: text("host").notNull(),
    method: text("method").notNull(),
    /** Path without query string, length-limited. */
    path: text("path").notNull(),
    status: integer("status").notNull(),
    durationMs: real("duration_ms").notNull(),
    bytes: integer("bytes").notNull(),
  },
  (table) => [
    index("access_log_entries_ts_idx").on(table.ts),
    index("access_log_entries_host_ts_idx").on(table.host, table.ts),
    index("access_log_entries_status_ts_idx").on(table.status, table.ts),
  ],
);

/** Hourly rollups per host and status code. Kept 13 months. */
export const trafficHourly = sqliteTable(
  "traffic_hourly",
  {
    /** Start of the UTC hour, epoch milliseconds. */
    bucketStart: integer("bucket_start").notNull(),
    host: text("host").notNull(),
    status: integer("status").notNull(),
    requests: integer("requests").notNull(),
    bytesOut: integer("bytes_out").notNull(),
    durationMsSum: real("duration_ms_sum").notNull(),
    durationMsMax: real("duration_ms_max").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.bucketStart, table.host, table.status] }),
  ],
);

/** Read position per log file, committed together with the rows it produced. */
export const ingestionCursors = sqliteTable("ingestion_cursors", {
  /** Path of the active log file, e.g. /config/logs/access.log. */
  path: text("path").primaryKey(),
  dev: integer("dev").notNull(),
  ino: integer("ino").notNull(),
  /** SHA-256 of the file's first line; recognizes reused inodes. */
  fingerprint: text("fingerprint"),
  /** Byte offset after the last complete line. */
  offset: integer("offset").notNull(),
  linesSkipped: integer("lines_skipped").notNull().default(0),
  /** Rotations whose old file was gone before it was read to the end. */
  gaps: integer("gaps").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
