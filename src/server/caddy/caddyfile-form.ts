import type { DiffLine } from "@/lib/line-diff";

import type { ApplyOutcome } from "./site-form";

export type CaddyfileEditorResult =
  | { kind: "error"; message: string }
  | {
      kind: "checked";
      warnings: string[];
      /** Against the file on disk; null if too large to compare. */
      diff: DiffLine[] | null;
      unchanged: boolean;
    }
  | { kind: "saved"; outcome: ApplyOutcome; warnings: string[] };

export interface CaddyfileEditorState {
  /** Text in the editor (echoed back). */
  content: string;
  /** The file on disk after this action, and its SHA-256. */
  fileContent: string;
  baseSha256: string;
  result?: CaddyfileEditorResult;
  /** Incremented per submission. */
  attempt: number;
}
