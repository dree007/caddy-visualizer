import "server-only";

import {
  type CaddyAdminClient,
  CaddyAdminError,
  createCaddyAdminClient,
} from "@/modules/caddy/admin-api";
import { configFingerprint } from "@/modules/caddy/config-fingerprint";
import { parseUpstreamHealth } from "@/modules/caddy/load-balancing";
import type { RateLimitModuleStatus } from "@/modules/caddy/rate-limit";
import { probeRateLimitModule } from "@/modules/caddy/rate-limit-probe";
import { type RunningSite, runningSites } from "@/modules/caddy/site-inventory";
import { listSites } from "@/modules/caddy/sites";
import { lastAppliedRevision } from "@/modules/caddy/revisions";
import { requireAccess } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { code } from "@/i18n/codes";

/*
 * Server-side entry point to Caddy's admin API. `server-only` makes the build
 * fail if a Client Component imports this file, so neither the address nor a
 * connection can ever reach the browser. There is deliberately no Server
 * Action or route that forwards arbitrary requests to Caddy.
 */

let cached: { key: string; client: CaddyAdminClient } | undefined;

/** The configured client, or `null` while `CADDY_ADMIN_URL` is not set. */
export function getCaddyAdminClient(): CaddyAdminClient | null {
  const address = getEnv().CADDY_ADMIN_URL;
  if (!address) return null;
  const key = JSON.stringify(address);
  if (cached?.key !== key) {
    // Short deadline: used for status display, not for applying.
    cached = {
      key,
      client: createCaddyAdminClient({ address, timeoutMs: 5000 }),
    };
  }
  return cached.client;
}

export type CaddyRuntimeStatus =
  | { state: "not-configured" }
  | { state: "unreachable"; message: string }
  | {
      state: "connected";
      /** Last revision the manager verified as running, if any. */
      lastApplied: { number: number; appliedAt: Date | null } | null;
      /**
       * Whether Caddy still runs exactly that revision (fingerprint of the
       * whole running config). `false` also after a manual reload of an edited
       * main Caddyfile; `null` without an applied revision.
       */
      matchesLastApplied: boolean | null;
    };

/**
 * Live, read-only check (`GET /config/`). The running config may contain
 * secrets; only its fingerprint is used here and nothing of it leaves the
 * server. Requires a session like every other server entry point.
 */
export async function checkCaddyRuntime(): Promise<CaddyRuntimeStatus> {
  await requireAccess();
  const client = getCaddyAdminClient();
  if (!client) return { state: "not-configured" };

  let fingerprint: string;
  try {
    fingerprint = configFingerprint((await client.getConfig()).config);
  } catch (error) {
    if (!(error instanceof CaddyAdminError)) throw error;
    console.error("Caddy admin API check failed", error);
    return { state: "unreachable", message: describeCaddyAdminError(error) };
  }
  const applied = lastAppliedRevision(getDb());
  return {
    state: "connected",
    lastApplied: applied
      ? { number: applied.number, appliedAt: applied.appliedAt }
      : null,
    matchesLastApplied: applied
      ? applied.expectedConfigFingerprint === fingerprint
      : null,
  };
}

/** Whether the running Caddy has the optional rate limit module; loads nothing. */
export async function checkRateLimitModule(): Promise<RateLimitModuleStatus> {
  await requireAccess();
  try {
    return await probeRateLimitModule(getCaddyAdminClient());
  } catch (error) {
    console.error("Rate limit module check failed", error);
    return "unknown";
  }
}

export interface OverviewSite extends RunningSite {
  /** Form site of the manager (with its id), or written by hand. */
  source: { kind: "form"; siteId: string } | { kind: "manual" };
}

export type RunningSitesResult =
  | { state: "not-configured" }
  | { state: "unreachable"; message: string }
  | { state: "ok"; sites: OverviewSite[] };

/**
 * Live list of the sites Caddy runs. Only the summary of `runningSites`
 * leaves the server, never the config itself (it may contain secrets).
 */
export async function loadRunningSites(): Promise<RunningSitesResult> {
  await requireAccess();
  return readRunningSites();
}

/** `loadRunningSites` without the session check, for background tasks. */
export async function readRunningSites(): Promise<RunningSitesResult> {
  const client = getCaddyAdminClient();
  if (!client) return { state: "not-configured" };
  let config: unknown;
  try {
    config = (await client.getConfig()).config;
  } catch (error) {
    if (!(error instanceof CaddyAdminError)) throw error;
    console.error("Caddy admin API read failed", error);
    return { state: "unreachable", message: describeCaddyAdminError(error) };
  }
  const db = getDb();
  const formSites = new Map(
    (await listSites(db)).map((site) => [site.hostname, site.id]),
  );
  return {
    state: "ok",
    sites: runningSites(config).map((site) => {
      const siteId = site.hosts
        .map((host) => formSites.get(host))
        .find((id) => id !== undefined);
      return {
        ...site,
        source: siteId ? { kind: "form", siteId } : { kind: "manual" },
      };
    }),
  };
}

/** Message code of a summary for the UI; Caddy's raw message stays in the server log. */
export function describeCaddyAdminError(error: CaddyAdminError): string {
  switch (error.kind) {
    case "timeout":
      return code("caddy.timeout");
    case "unreachable":
      return code("caddy.unreachable");
    case "http":
      return code("caddy.rejected", { status: error.status ?? 0 });
    case "invalid-response":
      return code("caddy.invalidResponse");
  }
}

export type UpstreamHealthResult =
  | { state: "not-configured" }
  | { state: "unreachable"; message: string }
  /** `host:port` → healthy, as Caddy sees it; absent = Caddy reports nothing. */
  | { state: "ok"; health: Record<string, boolean> };

/** Upstream health from Caddy's metrics (`GET /metrics`), read once per page view. */
export async function loadUpstreamHealth(): Promise<UpstreamHealthResult> {
  await requireAccess();
  const client = getCaddyAdminClient();
  if (!client) return { state: "not-configured" };
  try {
    const health = parseUpstreamHealth(await client.getMetrics());
    return { state: "ok", health: Object.fromEntries(health) };
  } catch (error) {
    if (!(error instanceof CaddyAdminError)) throw error;
    console.error("Caddy admin API metrics read failed", error);
    return { state: "unreachable", message: describeCaddyAdminError(error) };
  }
}
