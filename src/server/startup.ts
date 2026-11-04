import { ensureInitialAdmin } from "@/modules/auth/bootstrap";
import { deleteExpiredSessions } from "@/modules/auth/sessions";
import { startIngestion } from "@/server/access-log/ingestion";
import { startCertificateChecks } from "@/server/certificates/checks";
import { recoverOnStartup } from "@/server/caddy/engine";
import { getDb } from "@/server/db";
import { runMigrations } from "@/server/db/migrate";
import { getEnv, readAdminBootstrapSecrets } from "@/server/env";

/**
 * Runs once per server start (see `src/instrumentation.ts`):
 * validate configuration → apply migrations → ensure the admin account exists
 * (unless the built-in login is disabled).
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

  if (env.AUTH_DISABLED) {
    // No admin account needed; it is created as usual once the login is back on.
    log.warn(
      "[startup] AUTH_DISABLED: built-in login off; every request must be authenticated by the reverse proxy and the app must not be reachable otherwise",
    );
    if (env.BIND_ADDRESS === undefined) {
      log.warn(
        "[startup] AUTH_DISABLED: BIND_ADDRESS is unknown (not started with the release compose file), so published ports cannot be checked",
      );
    }
  } else {
    await bootstrapAdmin(env.ADMIN_USERNAME!, log);
  }

  await deleteExpiredSessions(db);

  // Settles revisions left open by a crash; never re-sends /load blindly.
  await recoverOnStartup(log);

  startIngestion(log);
  startCertificateChecks(log);
}

async function bootstrapAdmin(
  username: string,
  log: Pick<Console, "info" | "warn">,
): Promise<void> {
  const db = getDb();
  const secrets = readAdminBootstrapSecrets(process.env);
  const result = await ensureInitialAdmin(db, {
    username,
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
