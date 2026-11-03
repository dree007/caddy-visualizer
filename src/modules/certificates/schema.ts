import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Latest check per host name (no history). Only public certificate data;
 * private keys are never read. Rows of host names Caddy no longer serves are
 * removed after the next complete run.
 */
export const certificateChecks = sqliteTable("certificate_checks", {
  hostname: text("hostname").primaryKey(),
  /** `valid`, `expired`, `invalid`, `unreachable` or `blocked` at check time. */
  outcome: text("outcome").notNull(),
  /** Message code describing the problem; null when valid. */
  error: text("error"),
  /** Address the handshake went to. */
  address: text("address"),
  subject: text("subject"),
  issuer: text("issuer"),
  validFrom: integer("valid_from", { mode: "timestamp_ms" }),
  validTo: integer("valid_to", { mode: "timestamp_ms" }),
  sans: text("sans", { mode: "json" }).$type<string[]>(),
  fingerprint256: text("fingerprint256"),
  /** Last attempt, whatever its result. */
  checkedAt: integer("checked_at", { mode: "timestamp_ms" }).notNull(),
  /** Last attempt that found a valid certificate. */
  lastSuccessAt: integer("last_success_at", { mode: "timestamp_ms" }),
});
