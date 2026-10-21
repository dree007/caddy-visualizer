import { getEnv } from "@/server/env";

import { type Db, openDatabase } from "./client";

export type { Db } from "./client";

// One connection per process, reused across hot reloads in development.
const globalForDb = globalThis as unknown as { db?: Db };

export function getDb(): Db {
  globalForDb.db ??= openDatabase(getEnv().DATABASE_PATH);
  return globalForDb.db;
}
