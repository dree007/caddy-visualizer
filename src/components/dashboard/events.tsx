import type { Locale, Messages } from "@/i18n";
import { formatCount, formatDate, formatDateTime } from "@/lib/format";

export interface DashboardEvent {
  key: string;
  at: number;
  tone: "error" | "ok" | "neutral";
  title: string;
  detail: string;
}

export interface EventInput {
  errorBuckets: { start: number; label: string; errors: number }[];
  revisions: {
    number: number;
    status: string;
    at: number;
  }[];
  ingestion: { lastRunAt: Date | null; lastStored: number } | null;
}

/** Newest first; a handful of the things that happened lately. */
export function buildEvents(
  input: EventInput,
  locale: Locale,
  t: Messages,
): DashboardEvent[] {
  const e = t.dashboard.events;
  const events: DashboardEvent[] = [];
  for (const b of input.errorBuckets.filter((b) => b.errors > 0).slice(-2)) {
    events.push({
      key: `err-${b.start}`,
      at: b.start,
      tone: "error",
      title: e.serverErrors,
      detail: e.serverErrorsDetail(b.label, formatCount(b.errors, locale)),
    });
  }
  for (const r of input.revisions) {
    const applied = r.status === "applied";
    const failed = r.status === "failed";
    events.push({
      key: `rev-${r.number}`,
      at: r.at,
      tone: applied ? "ok" : failed ? "error" : "neutral",
      title: applied
        ? e.revisionApplied(r.number)
        : failed
          ? e.revisionFailed(r.number)
          : e.revisionOpen(r.number),
      detail: formatDateTime(r.at, locale),
    });
  }
  if (input.ingestion?.lastRunAt) {
    events.push({
      key: "ingest",
      at: input.ingestion.lastRunAt.getTime(),
      tone: "neutral",
      title: e.logRead,
      detail: e.logReadDetail(
        formatDate(input.ingestion.lastRunAt, locale, {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }),
        formatCount(input.ingestion.lastStored, locale),
      ),
    });
  }
  return events.sort((a, b) => b.at - a.at).slice(0, 5);
}

const DOT = {
  error: "bg-(--viz-critical)",
  ok: "bg-(--viz-series)",
  neutral: "border-2 border-(--viz-neutral) bg-card",
} as const;

export function EventList({
  events,
  t,
}: {
  events: DashboardEvent[];
  t: Messages;
}) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t.dashboard.events.empty}
      </p>
    );
  }
  return (
    <ol className="m-0 list-none border-l-2 border-border p-0">
      {events.map((event, i) => (
        <li
          key={event.key}
          className={`relative pl-[18px] ${i < events.length - 1 ? "pb-[18px]" : ""}`}
        >
          <span
            aria-hidden
            className={`absolute top-1.5 -left-[7px] box-border size-3 rounded-full ${DOT[event.tone]}`}
          />
          <div className="font-semibold">{event.title}</div>
          <div className="text-sm text-muted-foreground tabular-nums">
            {event.detail}
          </div>
        </li>
      ))}
    </ol>
  );
}
