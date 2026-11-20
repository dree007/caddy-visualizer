"use client";

import type { ReactNode } from "react";

import { useI18n } from "@/i18n/client";
import type {
  PendingChange,
  PendingChangeKind,
} from "@/modules/caddy/pending-changes";

import { useRouteDraft } from "./route-draft";

const MARKS: Record<PendingChangeKind | "draft", string> = {
  added: "+",
  draft: "+",
  removed: "−",
  enabled: "+",
  disabled: "−",
  changed: "~",
};

const MARK_TONES: Record<PendingChangeKind | "draft", string> = {
  added: "text-primary",
  draft: "text-primary",
  removed: "text-destructive",
  enabled: "text-primary",
  disabled: "text-destructive",
  changed: "text-muted-foreground",
};

/**
 * "Vorgemerkt": what the stored sites would change in Caddy compared with the
 * last applied revision, plus the route being typed in the inline row (client
 * state only), and the `sites.caddy` preview passed in from the server.
 */
export function PendingPanel({
  changes,
  base,
  configured,
  children,
}: {
  changes: PendingChange[];
  /** The last applied revision this comparison starts from. */
  base: { number: number; sha256: string } | null;
  /** Whether `CADDY_ADMIN_URL` is set, so there is something to apply to. */
  configured: boolean;
  /** The server-rendered `sites.caddy` preview. */
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const p = t.config.pending;
  const { draft } = useRouteDraft();
  const draftHost = draft.hostname.trim();
  const empty = changes.length === 0 && draftHost === "";

  return (
    <aside
      aria-labelledby="pending-heading"
      className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 rounded-xl border-2 border-foreground bg-card p-5 text-card-foreground"
    >
      <div>
        <h2 id="pending-heading" className="heading">
          {p.heading}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{p.intro}</p>
      </div>

      {empty ? (
        <p className="text-sm text-muted-foreground">
          {configured ? p.empty : p.emptyUnconfigured}
        </p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {draftHost ? (
            <li className="flex items-baseline gap-2.5">
              <Mark kind="draft" />
              <span className="min-w-0">
                {p.draft}{" "}
                <span className="mono [overflow-wrap:anywhere]">
                  {draftHost}
                </span>{" "}
                <span className="text-muted-foreground">({p.draftNote})</span>
                {draft.upstream.trim() ? (
                  <span className="mono block text-xs [overflow-wrap:anywhere] text-muted-foreground">
                    → {draft.upstream.trim()}
                  </span>
                ) : null}
              </span>
            </li>
          ) : null}
          {changes.map((change) => (
            <li
              key={`${change.kind}:${change.hostname}`}
              className="flex items-baseline gap-2.5"
            >
              <Mark kind={change.kind} />
              <span className="min-w-0">
                {p.kinds[change.kind]}{" "}
                <span className="mono [overflow-wrap:anywhere]">
                  {change.hostname}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {children}

      <p className="flex justify-between gap-3 text-xs text-muted-foreground">
        <span>{base ? p.base(base.number) : p.baseNone}</span>
        {base ? (
          <span className="mono">sha {base.sha256.slice(0, 12)}</span>
        ) : null}
      </p>
    </aside>
  );
}

function Mark({ kind }: { kind: PendingChangeKind | "draft" }) {
  return (
    <span
      aria-hidden
      className={`mono w-3 shrink-0 font-semibold ${MARK_TONES[kind]}`}
    >
      {MARKS[kind]}
    </span>
  );
}
