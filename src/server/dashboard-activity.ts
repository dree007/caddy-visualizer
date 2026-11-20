import "server-only";

import { lastAppliedRevision, listRevisions } from "@/modules/caddy/revisions";
import { ingestionStatus } from "@/server/access-log/ingestion";
import { requireAccess } from "@/server/auth/session";
import { getDb } from "@/server/db";

/** Recent revisions and the state of log ingestion, for the dashboard. */
export async function loadDashboardActivity() {
  await requireAccess();
  const db = getDb();
  const ingestion = ingestionStatus();
  return {
    revisions: listRevisions(db, 3).map((r) => ({
      number: r.number,
      status: r.status,
      at: (r.appliedAt ?? r.updatedAt).getTime(),
    })),
    runningRevision: lastAppliedRevision(db)?.number ?? null,
    ingestion: ingestion
      ? { lastRunAt: ingestion.lastRunAt, lastStored: ingestion.lastStored }
      : null,
  };
}
