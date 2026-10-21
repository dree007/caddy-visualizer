import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";
import {
  type BetterSQLite3Database,
  drizzle,
} from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

/**
 * Opens (and creates, if necessary) the SQLite database file.
 * `:memory:` is supported for tests.
 */
export function openDatabase(path: string): Db {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const sqlite = new Database(path);
  // WAL: readers never block the writer; required later for the worker container.
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  // SQLite does not enforce foreign keys unless enabled per connection.
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  if (path !== ":memory:") {
    // The container's root filesystem is read-only (no writable /tmp): temp
    // files (e.g. statement journals of large batches) go next to the database
    // on the data volume, else SQLITE_IOERR_GETTEMPPATH.
    sqlite.pragma(
      `temp_store_directory = '${dirname(path).replaceAll("'", "''")}'`,
    );
  }
  return drizzle(sqlite, { schema });
}
