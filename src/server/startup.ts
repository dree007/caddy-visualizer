import { ensureInitialAdmin } from "@/modules/auth/bootstrap";
import { deleteExpiredSessions } from "@/modules/auth/sessions";
import { startIngestion } from "@/server/access-log/ingestion";
import { recoverOnStartup } from "@/server/caddy/engine";
import { getDb } from "@/server/db";
import { runMigrations } from "@/server/db/migrate";
import { getEnv, readAdminBootstrapSecrets } from "@/server/env";

/**
 * Runs once per server start (see `src/instrumentation.ts`):
 * validate configuration → apply migrations → ensure the admin account exists.
 */
export async function runStartupTasks(
  log: Pick<Console, "info" | "warn"> = console,
): Promise<void> {
  const env = getEnv();
  const db = getDb();

  if (env.ALLOW_INSECURE_LAN_HTTP) {
    log.warn(
      "[startup] ALLOW_INSECURE_LAN_HTTP: passwords and sessions travel unencrypted",
    );
  }

  runMigrations(db);
  log.info("[startup] database migrations applied");

  const secrets = readAdminBootstrapSecrets(process.env);
  const result = await ensureInitialAdmin(db, {
    username: env.ADMIN_USERNAME,
    ...secrets,
  });
  switch (result.status) {
    case "created":
      log.info(`[startup] admin account "${result.username}" created`);
      log.warn(
        "[startup] remove ADMIN_INITIAL_PASSWORD(_FILE) from the configuration now",
      );
      break;
    case "password-reset":
      log.warn(
        `[startup] password of "${result.username}" reset, all sessions revoked`,
      );
      log.warn(
        "[startup] remove ADMIN_RESET_PASSWORD and ADMIN_INITIAL_PASSWORD(_FILE) now",
      );
      break;
    case "unchanged":
      if (secrets.password !== undefined) {
        log.warn(
          "[startup] admin exists; ADMIN_INITIAL_PASSWORD(_FILE) is ignored and should be removed",
        );
      }
      break;
    case "username-mismatch":
      log.warn(
        `[startup] ADMIN_USERNAME "${result.configured}" does not match the existing admin account; nothing was changed`,
      );
      break;
  }

  await deleteExpiredSessions(db);

  // Settles revisions left open by a crash; never re-sends /load blindly.
  await recoverOnStartup(log);

  startIngestion(log);
}

/** Fail fast: never serve requests with an unmigrated database or invalid configuration. */
export async function runStartupTasksOrExit(): Promise<void> {
  try {
    await runStartupTasks();
  } catch (error) {
    // Messages are written without secret values (see env.ts), so they are safe to log.
    console.error(
      `[startup] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
