import "server-only";

import {
  type Candidate,
  certificateCandidates,
  checkTargets,
} from "@/modules/certificates/candidates";
import { probeCertificate } from "@/modules/certificates/probe";
import {
  type CertificateView,
  certificateView,
} from "@/modules/certificates/status";
import {
  listCertificateChecks,
  pruneCertificateChecks,
  runCertificateChecks,
} from "@/modules/certificates/store";
import { requireAccess } from "@/server/auth/session";
import { type OverviewSite, readRunningSites } from "@/server/caddy/admin";
import { instanceLockFailure } from "@/server/caddy/engine";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";

/*
 * Certificate checks inside the web process: a manual run from the UI and a
 * periodic run on the instance holding the managed directory's lock. At most
 * one run at a time; a request during a run joins it.
 */

const INTERVAL_MS = 6 * 3600_000;
const FIRST_RUN_DELAY_MS = 60_000;
/** A manual request this soon after a finished run shows that run instead. */
const MANUAL_COOLDOWN_MS = 30_000;

export type CheckRunResult =
  | { state: "done"; checked: number }
  | { state: "recent" }
  | { state: "not-configured" }
  | { state: "unreachable"; message: string };

const globalForChecks = globalThis as unknown as {
  certificateChecks?: {
    running: Promise<CheckRunResult> | null;
    finishedAt: number;
    timer?: NodeJS.Timeout;
  };
};

function state() {
  return (globalForChecks.certificateChecks ??= {
    running: null,
    finishedAt: 0,
  });
}

export function isCertificateCheckRunning(): boolean {
  return state().running !== null;
}

/** Runs (or joins) a check of every host name Caddy currently serves. */
export function runCertificateCheck(
  trigger: "manual" | "schedule",
): Promise<CheckRunResult> {
  const current = state();
  if (current.running) return current.running;
  if (
    trigger === "manual" &&
    Date.now() - current.finishedAt < MANUAL_COOLDOWN_MS
  ) {
    return Promise.resolve({ state: "recent" });
  }
  current.running = checkAll().finally(() => {
    current.running = null;
    current.finishedAt = Date.now();
  });
  return current.running;
}

async function checkAll(): Promise<CheckRunResult> {
  const running = await readRunningSites();
  if (running.state !== "ok") return running;
  const candidates = certificateCandidates(running.sites);
  const targets = checkTargets(candidates);
  const db = getDb();
  const trustedPrivateDomains = getEnv().CERT_CHECK_PRIVATE_DOMAINS;
  await runCertificateChecks(db, targets, (hostname) =>
    probeCertificate(hostname, { trustedPrivateDomains }),
  );
  // Only after a complete inventory: never forget results because Caddy was down.
  pruneCertificateChecks(
    db,
    candidates.map((candidate) => candidate.hostname),
  );
  return { state: "done", checked: targets.length };
}

export function startCertificateChecks(
  log: Pick<Console, "info" | "warn">,
): void {
  const current = state();
  if (current.timer) return;
  const run = async () => {
    // Only one manager checks periodically, like the access log ingestion.
    if (instanceLockFailure()) return;
    try {
      const result = await runCertificateCheck("schedule");
      if (result.state === "done") {
        log.info(`[certificates] checked ${result.checked} host names`);
      }
    } catch (error) {
      log.warn(
        `[certificates] check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  current.timer = setInterval(run, INTERVAL_MS);
  current.timer.unref();
  setTimeout(run, FIRST_RUN_DELAY_MS).unref();
}

export interface CertificateOverview {
  state: "ok" | "unreachable" | "not-configured";
  /** Caddy's message code when its configuration could not be read. */
  message?: string;
  views: CertificateView[];
  lastCheckedAt: Date | null;
  running: boolean;
}

/**
 * Host names of the running configuration with their last results. Without
 * Caddy, the stored results are shown on their own.
 */
export async function loadCertificateOverview(
  sites?: OverviewSite[],
): Promise<CertificateOverview> {
  await requireAccess();
  const running = sites
    ? { state: "ok" as const, sites }
    : await readRunningSites();
  const checks = listCertificateChecks(getDb());
  const candidates: Candidate[] =
    running.state === "ok"
      ? certificateCandidates(running.sites)
      : [...checks.keys()].map((hostname) => ({ hostname, checkable: true }));
  const now = new Date();
  const views = candidates.map((candidate) =>
    certificateView(candidate, checks.get(candidate.hostname) ?? null, now),
  );
  let lastCheckedAt: Date | null = null;
  for (const check of checks.values()) {
    if (!lastCheckedAt || check.checkedAt > lastCheckedAt) {
      lastCheckedAt = check.checkedAt;
    }
  }
  return {
    state: running.state,
    message: running.state === "unreachable" ? running.message : undefined,
    views,
    lastCheckedAt,
    running: isCertificateCheckRunning(),
  };
}
