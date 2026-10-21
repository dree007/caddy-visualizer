import "server-only";

import {
  type ApplyResult,
  APPLY_MESSAGES,
  type CaddyfileCheckResult,
  type RollbackResult,
} from "@/modules/caddy/apply-engine";
import type { RevisionTrigger } from "@/modules/caddy/schema";
import { requireSession } from "@/server/auth/session";
import { code } from "@/i18n/codes";

import { applyLogger, getApplyEngine } from "./engine";
import type { ApplyOutcome } from "./site-form";

export type { ApplyOutcome };

/*
 * Session-checked entry points to the apply engine for Server Actions. They
 * are not Server Actions themselves (no public endpoint of their own).
 */

/** Applies the desired state after a successful change in the database. */
export async function applyAfterChange(
  trigger: RevisionTrigger,
): Promise<ApplyOutcome> {
  await requireSession();
  const engine = getApplyEngine();
  if (!engine) return { state: "not-configured" };
  return guarded(() => engine.apply(trigger));
}

export async function rollbackToRevision(
  revisionId: string,
): Promise<ApplyOutcome> {
  await requireSession();
  const engine = getApplyEngine();
  if (!engine) return { state: "not-configured" };
  return guarded(() => engine.rollback(revisionId));
}

/** Dry run of an edited main Caddyfile (nothing stored or loaded). */
export async function checkCaddyfile(
  content: string,
): Promise<CaddyfileCheckResult> {
  await requireSession();
  const engine = getApplyEngine();
  if (!engine) return { ok: false, message: NOT_CONFIGURED };
  try {
    return await engine.checkCaddyfile(content);
  } catch (error) {
    applyLogger.error("Caddyfile check failed unexpectedly", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: APPLY_MESSAGES.internal };
  }
}

/** Applies an edited main Caddyfile (see `ApplyEngine.applyCaddyfile`). */
export async function applyCaddyfile(
  content: string,
  baseSha256: string,
): Promise<ApplyOutcome> {
  await requireSession();
  const engine = getApplyEngine();
  if (!engine) return { state: "not-configured" };
  return guarded(() => engine.applyCaddyfile(content, baseSha256));
}

const NOT_CONFIGURED = code("apply.notConfigured");

/** Re-checks unsettled revisions against the running Caddy config. */
export async function recoverRevisions(): Promise<void> {
  await requireSession();
  await getApplyEngine()?.recover();
}

async function guarded(
  run: () => Promise<ApplyResult | RollbackResult>,
): Promise<ApplyOutcome> {
  try {
    return toOutcome(await run());
  } catch (error) {
    applyLogger.error("apply failed unexpectedly", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { state: "failed", message: APPLY_MESSAGES.internal };
  }
}

function toOutcome(result: ApplyResult | RollbackResult): ApplyOutcome {
  switch (result.status) {
    case "applied":
      return { state: "applied", revisionNumber: result.revision.number };
    case "rejected":
      return { state: "failed", message: result.message };
    case "failed":
      return {
        state: "failed",
        message: result.message,
        revisionNumber: result.revision?.number,
      };
    case "pending":
    case "recovery-required":
      return {
        state: result.status,
        message: result.message,
        revisionNumber: result.revision.number,
      };
  }
}
