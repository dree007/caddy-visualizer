import { ScrollText } from "lucide-react";

import { translateCode } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { formatCount, formatDateTime } from "@/lib/format";
import { loadIngestionStatus } from "@/server/access-log/queries";

export async function IngestionCard() {
  const [{ path, runtime, cursor }, { locale, t }] = await Promise.all([
    loadIngestionStatus(),
    getI18n(),
  ]);
  const g = t.settings.ingestion;
  const state = runtime?.state ?? "idle";
  return (
    <section
      aria-labelledby="ingestion-heading"
      className="surface flex flex-col gap-3 p-5 md:p-7"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-stone text-foreground shadow-pressed">
          <ScrollText aria-hidden className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 id="ingestion-heading" className="heading">
            {g.heading}
          </h2>
          <p className="font-mono text-xs [overflow-wrap:anywhere] text-muted-foreground">
            {path}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{g.status}</dt>
        <dd
          className={
            state === "error" || state === "missing" || state === "unreadable"
              ? "text-destructive"
              : undefined
          }
        >
          {g.states[state]}
          {runtime?.message ? ` · ${translateCode(t, runtime.message)}` : ""}
        </dd>
        {runtime?.lastRunAt ? (
          <>
            <dt className="text-muted-foreground">{g.lastRun}</dt>
            <dd>{formatDateTime(runtime.lastRunAt, locale)}</dd>
          </>
        ) : null}
        {cursor ? (
          <>
            <dt className="text-muted-foreground">{g.skipped}</dt>
            <dd className="tabular-nums">
              {formatCount(cursor.linesSkipped, locale)}
            </dd>
            <dt className="text-muted-foreground">{g.gaps}</dt>
            <dd className="tabular-nums">{formatCount(cursor.gaps, locale)}</dd>
          </>
        ) : null}
      </dl>
      {state === "missing" ? (
        <p className="text-sm text-muted-foreground">{g.missingHelp}</p>
      ) : null}
      {state === "unreadable" ? (
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>{g.unreadableHelp}</p>
          <code className="code-well block px-4 py-3 [overflow-wrap:anywhere] text-foreground select-all">
            docker exec caddy chmod 644 {path}
          </code>
        </div>
      ) : null}
    </section>
  );
}
