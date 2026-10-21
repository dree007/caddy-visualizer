import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { TLS_MODES } from "./tls";

/**
 * Source of truth for the sites managed by Caddy Visualizer. `sites.caddy` is
 * generated from these rows; there is deliberately no raw Caddyfile column.
 * Values are stored in normalized form (see `contracts.ts`).
 */
export const caddySites = sqliteTable(
  "caddy_sites",
  {
    id: text("id").primaryKey(),
    /** Lower-case DNS name, unique across all managed sites. */
    hostname: text("hostname").notNull().unique(),
    /** Canonical reverse-proxy upstream `http(s)://host[:port]`. */
    upstream: text("upstream").notNull(),
    tls: text("tls", { enum: TLS_MODES }).notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check("caddy_sites_tls_check", sql`${table.tls} in ('automatic', 'off')`),
    check("caddy_sites_enabled_check", sql`${table.enabled} in (0, 1)`),
  ],
);

export type CaddySiteRow = typeof caddySites.$inferSelect;

/** Lifecycle of a config revision (see ARCHITECTURE.md 5.5). */
export const REVISION_STATUSES = [
  /** Created and staged; not yet sent to Caddy. */
  "pending",
  /** `/load` was (or is being) sent; outcome not yet recorded. */
  "loading",
  /** Caddy runs this revision (verified) and `sites.caddy` contains it. */
  "applied",
  /** Caddy did not take this revision; it keeps running the previous config. */
  "failed",
  /** Outcome could not be determined; needs a check before anything else. */
  "recovery-required",
] as const;

export type RevisionStatus = (typeof REVISION_STATUSES)[number];

export const REVISION_TRIGGERS = [
  "site-created",
  "site-updated",
  "site-enabled",
  "site-disabled",
  "site-deleted",
  "retry",
  "rollback",
  "caddyfile-updated",
] as const;

export type RevisionTrigger = (typeof REVISION_TRIGGERS)[number];

/**
 * Every attempt to bring Caddy to a managed configuration. A revision owns the
 * exact `sites.caddy` text it was created with and is never regenerated from
 * the current sites, so it can be re-applied (rollback) at any time.
 */
export const configRevisions = sqliteTable(
  "config_revisions",
  {
    id: text("id").primaryKey(),
    /** Sequential number (1, 2, …): total order and a readable label (#12). */
    number: integer("number").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    trigger: text("trigger", { enum: REVISION_TRIGGERS }).notNull(),
    /** Revision whose content a rollback re-applies. */
    sourceRevisionId: text("source_revision_id"),
    /** Exact content of `sites.caddy` (final newline included). */
    configContent: text("config_content").notNull(),
    configSha256: text("config_sha256").notNull(),
    /** JSON array of the managed sites the content was generated from. */
    sitesSnapshot: text("sites_snapshot").notNull(),
    /**
     * The main Caddyfile this revision brings Caddy to (snapshot for history
     * and rollback; the file on disk stays the source of truth). Null in
     * revisions from before the Caddyfile editor.
     */
    mainContent: text("main_content"),
    status: text("status", { enum: REVISION_STATUSES }).notNull(),
    /**
     * SHA-256 of the canonical JSON Caddy adapted from the full Caddyfile with
     * this revision. Equal to the running config's fingerprint iff Caddy runs
     * exactly this configuration. Set before `/load`.
     */
    expectedConfigFingerprint: text("expected_config_fingerprint"),
    /** Sanitized, UI-safe message; never raw Caddy output. */
    errorMessage: text("error_message"),
    appliedAt: integer("applied_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    check(
      "config_revisions_status_check",
      sql`${table.status} in ('pending', 'loading', 'applied', 'failed', 'recovery-required')`,
    ),
    index("config_revisions_status_idx").on(table.status),
  ],
);

export type ConfigRevisionRow = typeof configRevisions.$inferSelect;
