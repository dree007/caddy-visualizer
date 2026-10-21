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
  release(): void;
}

export function createInstanceLock(path: string): InstanceLock {
  let connection: Database.Database | null = null;

  return {
    acquire() {
      if (connection) return true;
      // Never follow a symlink planted at the lock path.
      try {
        if (lstatSync(path).isSymbolicLink()) return false;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") return false;
      }
      let candidate: Database.Database | undefined;
      try {
        candidate = new Database(path, { timeout: 0 });
        // Rollback journal, no WAL: the lock is a plain file lock.
        candidate.pragma("journal_mode = DELETE");
        candidate.exec("BEGIN EXCLUSIVE");
        connection = candidate;
        return true;
      } catch {
        candidate?.close();
        return false;
      }
    },
    get held() {
      return connection !== null;
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
