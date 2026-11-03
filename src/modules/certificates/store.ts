import { inArray, not, sql } from "drizzle-orm";

import { code } from "@/i18n/codes";
import type { Db } from "@/server/db/client";

import type { ProbeResult } from "./probe";
import { certificateChecks } from "./schema";

export type CertificateCheck = typeof certificateChecks.$inferSelect & {
  outcome: ProbeResult["outcome"];
};

/** Parallel handshakes per run. */
export const CHECK_CONCURRENCY = 4;

export function listCertificateChecks(db: Db): Map<string, CertificateCheck> {
  const rows = db.select().from(certificateChecks).all() as CertificateCheck[];
  return new Map(rows.map((row) => [row.hostname, row]));
}

export function saveCertificateCheck(
  db: Db,
  hostname: string,
  result: ProbeResult,
  checkedAt: Date,
): void {
  const cert = result.certificate;
  const update = {
    outcome: result.outcome,
    error: result.error,
    address: result.address,
    subject: cert?.subject ?? null,
    issuer: cert?.issuer ?? null,
    validFrom: cert?.validFrom ?? null,
    validTo: cert?.validTo ?? null,
    sans: cert?.sans ?? null,
    fingerprint256: cert?.fingerprint256 ?? null,
    checkedAt,
    lastSuccessAt: result.outcome === "valid" ? checkedAt : null,
  };
  db.insert(certificateChecks)
    .values({ hostname, ...update })
    .onConflictDoUpdate({
      target: certificateChecks.hostname,
      set: {
        ...update,
        // A failed attempt keeps the time of the last valid one.
        lastSuccessAt: sql`coalesce(excluded.last_success_at, ${certificateChecks.lastSuccessAt})`,
      },
    })
    .run();
}

/** Drops results of host names that are no longer served. */
export function pruneCertificateChecks(db: Db, keep: readonly string[]): void {
  db.delete(certificateChecks)
    .where(
      keep.length === 0
        ? undefined
        : not(inArray(certificateChecks.hostname, [...keep])),
    )
    .run();
}

/**
 * Checks the host names with at most `concurrency` handshakes at a time and
 * stores each result as soon as it is known.
 */
export async function runCertificateChecks(
  db: Db,
  hostnames: readonly string[],
  probe: (hostname: string) => Promise<ProbeResult>,
  { concurrency = CHECK_CONCURRENCY, now = () => new Date() } = {},
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < hostnames.length) {
      const hostname = hostnames[next++]!;
      let result: ProbeResult;
      try {
        result = await probe(hostname);
      } catch {
        // One broken check must not end the run for the others.
        result = {
          outcome: "unreachable",
          error: code("cert.checkFailed"),
          address: null,
          certificate: null,
        };
      }
      saveCertificateCheck(db, hostname, result, now());
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, hostnames.length) }, worker),
  );
}
