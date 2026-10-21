import { sql } from "drizzle-orm";

import { checkHealth } from "@/modules/system/health";
import { getDb } from "@/server/db";

// Always evaluated at request time; never cached. Public (see proxy.ts).
export const dynamic = "force-dynamic";

export async function GET() {
  const report = await checkHealth({
    pingDatabase: async () => {
      getDb().get(sql`select 1`);
    },
  });
  return Response.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
