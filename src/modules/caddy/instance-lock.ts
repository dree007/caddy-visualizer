import { lstatSync } from "node:fs";

import Database from "better-sqlite3";

/**
 * Ensures that only one Caddy Visualizer process applies to a managed directory.
 *
 * Implementation: an exclusive SQLite transaction on a small lock file, held
 * for the life of the process. SQLite uses POSIX `fcntl` locks, which the
 * kernel releases when the process exits or crashes, so there is no stale
 * lock, no PID file and no lease timeout. Works across containers on the same
 * host that mount the same directory (same kernel, local file system); not on
 * network file systems.
 */
export interface InstanceLock {
  /** Tries to take the lock (non-blocking). True if this process holds it. */
  acquire(): boolean;
  readonly held: boolean;
  /** Why the last `acquire()` failed; null while held or before the first try. */
  readonly failure: InstanceLockFailure | null;
  release(): void;
}

export type InstanceLockFailure =
  /** Another process holds the lock. */
  | { reason: "busy" }
  /** The lock file cannot be used at all (missing or read-only directory, symlink …). */
  | { reason: "unavailable"; error: string };

export function createInstanceLock(path: string): InstanceLock {
  let connection: Database.Database | null = null;
  let failure: InstanceLockFailure | null = null;

  function take(): InstanceLockFailure | null {
    // Never follow a symlink planted at the lock path.
    try {
      if (lstatSync(path).isSymbolicLink()) {
        return { reason: "unavailable", error: `${path} is a symlink` };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        return unavailable(error);
      }
    }
    let candidate: Database.Database | undefined;
    try {
      // A missing directory fails closed (an unmounted volume must not get a
      // private lock of its own), but as "unavailable", not as "busy".
      candidate = new Database(path, { timeout: 0 });
      // Rollback journal, no WAL: the lock is a plain file lock.
      candidate.pragma("journal_mode = DELETE");
      candidate.exec("BEGIN EXCLUSIVE");
      connection = candidate;
      return null;
    } catch (error) {
      candidate?.close();
      const code = (error as { code?: unknown }).code;
      // SQLITE_BUSY (and extended codes): the other process's lock.
      if (typeof code === "string" && code.startsWith("SQLITE_BUSY")) {
        return { reason: "busy" };
      }
      return unavailable(error);
    }
  }

  return {
    acquire() {
      if (connection) return true;
      failure = take();
      return failure === null;
    },
    get held() {
      return connection !== null;
    },
    get failure() {
      return failure;
    },
    release() {
      if (!connection) return;
      try {
        connection.exec("ROLLBACK");
      } finally {
        connection.close();
        connection = null;
      }
    },
  };
}

function unavailable(error: unknown): InstanceLockFailure {
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  return {
    reason: "unavailable",
    error: typeof code === "string" ? `${code}: ${message}` : message,
  };
}
