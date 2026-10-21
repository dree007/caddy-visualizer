"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/server/auth/session";

import {
  applyAfterChange,
  recoverRevisions,
  rollbackToRevision,
} from "./apply";
import type { ApplyOutcome } from "./site-form";
import { getI18n } from "@/i18n/server";

/*
 * Server Actions for the sync status: retry, rollback and re-check. Each one
 * checks the session; IDs are validated before they reach the engine.
 */

/** Applies the current desired state again (after a failure or out of sync). */
export async function retryApplyAction(): Promise<ApplyOutcome> {
  await requireSession();
  const outcome = await applyAfterChange("retry");
  revalidatePath("/config", "layout");
  return outcome;
}

/** Re-applies the exact content of an earlier revision as a new revision. */
export async function rollbackRevisionAction(
  revisionId: unknown,
): Promise<ApplyOutcome> {
  await requireSession();
  const id = z.uuid().safeParse(revisionId);
  if (!id.success) {
    return {
      state: "failed",
      message: (await getI18n()).t.config.rollback.notFound,
    };
  }
  const outcome = await rollbackToRevision(id.data);
  revalidatePath("/config", "layout");
  return outcome;
}

/** Compares unsettled revisions with what Caddy runs (no /load). */
export async function recheckApplyStatusAction(): Promise<void> {
  await requireSession();
  await recoverRevisions();
  revalidatePath("/config", "layout");
}
