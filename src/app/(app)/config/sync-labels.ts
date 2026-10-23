import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  LoaderCircle,
  type LucideIcon,
  TriangleAlert,
} from "lucide-react";

import type { Messages } from "@/i18n";
import type { RevisionStatus } from "@/modules/caddy/schema";
import type { SyncState } from "@/modules/caddy/sync-status";
import type { ApplyOutcome } from "@/server/caddy/site-form";

export type Tone = "success" | "progress" | "warning" | "error" | "neutral";

export const SYNC_TONES: Record<SyncState, Tone> = {
  synced: "success",
  applying: "progress",
  checking: "progress",
  failed: "error",
  "recovery-required": "warning",
  "out-of-sync": "warning",
  idle: "neutral",
  "other-instance": "warning",
  "lock-unavailable": "error",
  "not-configured": "neutral",
};

export const REVISION_TONES: Record<RevisionStatus, Tone> = {
  pending: "progress",
  loading: "progress",
  applied: "success",
  failed: "error",
  "recovery-required": "warning",
};

/** Second sentence after "… was saved/created" etc. */
export function applySentence(
  t: Messages,
  outcome: Pick<ApplyOutcome, "state">,
): { text: string; tone: Tone } {
  switch (outcome.state) {
    case "applied":
      return { text: t.config.apply.applied, tone: "success" };
    case "failed":
      return { text: t.config.apply.failed, tone: "error" };
    case "pending":
    case "recovery-required":
      return { text: t.config.apply.pending, tone: "warning" };
    case "not-configured":
      return { text: t.config.apply.notConfigured, tone: "neutral" };
  }
}

export const TONE_CLASSES: Record<Tone, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  progress: "text-sky-600 dark:text-sky-400",
  warning: "text-amber-600 dark:text-amber-400",
  error: "text-destructive",
  neutral: "text-muted-foreground",
};

export const TONE_ICONS: Record<Tone, LucideIcon> = {
  success: CircleCheck,
  progress: LoaderCircle,
  warning: TriangleAlert,
  error: CircleAlert,
  neutral: CircleDashed,
};

export const TONE_BORDERS: Record<Tone, string> = {
  success: "border-emerald-600/30",
  progress: "border-sky-600/30",
  warning: "border-amber-600/40",
  error: "border-destructive/40",
  neutral: "",
};
