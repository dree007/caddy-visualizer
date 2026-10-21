import { ingestOnce, pruneAccessLog } from "@/modules/access-log/ingest";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";

import { isActiveInstance } from "../caddy/engine";
import { code } from "@/i18n/codes";

/*
 * Reads Caddy's access log every few seconds inside the web process (no
 * separate worker container). Only the instance holding the managed
 * directory's lock ingests, so two managers never count twice.
 */

const INTERVAL_MS = 10_000;
const PRUNE_EVERY_MS = 3600_000;

export interface IngestionStatus {
  path: string;
  state: "idle" | "missing" | "unreadable" | "ok" | "error" | "passive";
  lastRunAt: Date | null;
  lastStored: number;
  message?: string;
}

const globalForIngestion = globalThis as unknown as {
  accessLogIngestion?: { timer: NodeJS.Timeout; status: IngestionStatus };
};

/** A file the manager may not read (Caddy created it before `mode 644`) gets its own state. */
export function errorState(
  error: unknown,
): Pick<IngestionStatus, "state" | "message"> {
  const errno = (error as NodeJS.ErrnoException | null)?.code;
  if (errno === "EACCES" || errno === "EPERM") return { state: "unreadable" };
  return {
    state: "error",
    message: error instanceof Error ? error.message : String(error),
  };
}

export function ingestionStatus(): IngestionStatus | null {
  return globalForIngestion.accessLogIngestion?.status ?? null;
}

export function startIngestion(log: Pick<Console, "info" | "warn">): void {
  if (globalForIngestion.accessLogIngestion) return;
  const path = getEnv().CADDY_ACCESS_LOG_FILE;
  const status: IngestionStatus = {
    path,
    state: "idle",
    lastRunAt: null,
    lastStored: 0,
  };
  let running = false;
  let lastPrune = 0;
  let lastState: IngestionStatus["state"] = "idle";

  const run = async () => {
    if (running) return;
    running = true;
    try {
      if (!isActiveInstance()) {
        status.state = "passive";
        return;
      }
      const db = getDb();
      const result = await ingestOnce(db, path);
      status.state = result.state;
      status.lastStored = result.stored;
      status.message = result.gap ? code("ingestion.gap") : undefined;
      if (Date.now() - lastPrune > PRUNE_EVERY_MS) {
        pruneAccessLog(db);
        lastPrune = Date.now();
      }
    } catch (error) {
      Object.assign(status, { message: undefined }, errorState(error));
    } finally {
      status.lastRunAt = new Date();
      if (status.state !== lastState) {
        const line = `[access-log] ${path}: ${status.state}${status.message ? ` (${status.message})` : ""}`;
        if (status.state === "error" || status.state === "unreadable")
          log.warn(line);
        else log.info(line);
        lastState = status.state;
      }
      running = false;
    }
  };

  const timer = setInterval(run, INTERVAL_MS);
  timer.unref();
  globalForIngestion.accessLogIngestion = { timer, status };
  void run();
}
