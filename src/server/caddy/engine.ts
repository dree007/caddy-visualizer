import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createCaddyAdminClient } from "@/modules/caddy/admin-api";
import {
  type ApplyEngine,
  type ApplyLogger,
  createApplyEngine,
} from "@/modules/caddy/apply-engine";
import {
  createInstanceLock,
  type InstanceLockFailure,
} from "@/modules/caddy/instance-lock";
import { createManagedFiles } from "@/modules/caddy/managed-files";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";

/*
 * Factory of the apply engine (no session check; used by the session-checked
 * `apply.ts` and by start-up recovery). One engine (and thus one mutex) per
 * process, kept on globalThis so that hot reloads and the separately bundled
 * instrumentation share it. Nothing here is reachable from the browser except
 * through the session-checked Server Actions.
 */

export const LOCK_FILE = ".manager.lock";

/** Generous: `/load` provisions the new config before it answers. */
const APPLY_TIMEOUT_MS = 30_000;

const globalForApply = globalThis as unknown as {
  caddyApply?: { key: string; engine: ApplyEngine };
};

export function isCaddyConfigured(): boolean {
  return getEnv().CADDY_ADMIN_URL !== undefined;
}

export function getApplyEngine(): ApplyEngine | null {
  const env = getEnv();
  if (!env.CADDY_ADMIN_URL) return null;
  const key = JSON.stringify([
    env.CADDY_ADMIN_URL,
    env.CADDY_MAIN_CADDYFILE,
    env.CADDY_MANAGED_DIR,
  ]);
  if (globalForApply.caddyApply?.key !== key) {
    globalForApply.caddyApply = {
      key,
      engine: createApplyEngine({
        db: getDb(),
        caddy: createCaddyAdminClient({
          address: env.CADDY_ADMIN_URL,
          timeoutMs: APPLY_TIMEOUT_MS,
        }),
        files: createManagedFiles(env.CADDY_MANAGED_DIR),
        mainCaddyfilePath: env.CADDY_MAIN_CADDYFILE,
        log: applyLogger,
        // One manager per managed directory (released by the kernel on exit).
        lock: createInstanceLock(join(env.CADDY_MANAGED_DIR, LOCK_FILE)),
      }),
    };
  }
  return globalForApply.caddyApply.engine;
}

/** The main Caddyfile as the manager sees it (read-only use). */
export function readMainCaddyfile(): Promise<string> {
  return readFile(getEnv().CADDY_MAIN_CADDYFILE, "utf8");
}

/**
 * Why this process may not apply and ingest: another manager instance holds
 * the lock of the managed directory, or the lock file cannot be used. Null if
 * it may (or Caddy is not configured).
 */
export function instanceLockFailure(): InstanceLockFailure | null {
  return getApplyEngine()?.instanceLockFailure() ?? null;
}

export function isApplyRunning(): boolean {
  return globalForApply.caddyApply?.engine.busy ?? false;
}

/** Start-up recovery (no session: runs before any request). Never throws. */
export async function recoverOnStartup(
  log: Pick<Console, "info" | "warn">,
): Promise<void> {
  const engine = getApplyEngine();
  if (!engine) {
    log.info(
      "[startup] Caddy admin API not configured; changes are only stored",
    );
    return;
  }
  try {
    const { revision } = await engine.recover();
    if (revision) {
      log.info(
        `[startup] Caddy config revision #${revision.number} is ${revision.status}`,
      );
    }
  } catch (error) {
    log.warn(
      `[startup] Caddy recovery failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** One line per event; never config contents, secrets or request bodies. */
export const applyLogger: ApplyLogger = {
  info: (event, fields) => console.info(line(event, fields)),
  warn: (event, fields) => console.warn(line(event, fields)),
  error: (event, fields) => console.error(line(event, fields)),
};

function line(event: string, fields?: Record<string, unknown>): string {
  return `[caddy-apply] ${event}${fields ? ` ${JSON.stringify(fields)}` : ""}`;
}
