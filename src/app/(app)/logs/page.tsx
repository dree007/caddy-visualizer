import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { formatBytes, formatLogTime, formatMs } from "@/lib/format";
import { normalizeHost } from "@/modules/access-log/parser";
import { STATUS_CLASSES, type StatusClass } from "@/modules/access-log/queries";
import { loadLogEntries } from "@/server/access-log/queries";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.logs.title };
}

const PAGE_SIZE = 100;

const STATUS_TONE: Record<StatusClass, string> = {
  "2xx": "text-foreground",
  "3xx": "text-muted-foreground",
  "4xx": "text-amber-700 dark:text-amber-400",
  "5xx": "text-destructive",
};

export default async function LogsPage({ searchParams }: PageProps<"/logs">) {
  const params = await searchParams;
  const { locale, t } = await getI18n();
  const l = t.logs;
  const host =
    typeof params.host === "string" ? normalizeHost(params.host) : null;
  const statusClass = STATUS_CLASSES.find((c) => c === params.status);
  const path = typeof params.path === "string" ? params.path.slice(0, 200) : "";
  const before = Number(params.before);
  const { entries, hosts } = await loadLogEntries({
    host: host ?? undefined,
    statusClass,
    path: path || undefined,
    beforeId: Number.isInteger(before) && before > 0 ? before : undefined,
    limit: PAGE_SIZE,
  });

  const filtered = Boolean(host || statusClass || path);
  const older =
    entries.length === PAGE_SIZE
      ? {
          ...(host ? { host } : {}),
          ...(statusClass ? { status: statusClass } : {}),
          ...(path ? { path } : {}),
          before: String(entries.at(-1)!.id),
        }
      : null;

  return (
    <div className="flex flex-col gap-4">
      <form
        method="get"
        className="flex flex-wrap items-end gap-2"
        aria-label={l.filter}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{l.host}</span>
          <select
            name="host"
            defaultValue={host ?? ""}
            className="field h-11 min-w-0 px-3 md:h-10"
          >
            <option value="">{l.all}</option>
            {hosts.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{l.status}</span>
          <select
            name="status"
            defaultValue={statusClass ?? ""}
            className="field h-11 px-3 md:h-10"
          >
            <option value="">{l.all}</option>
            {STATUS_CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{l.pathContains}</span>
          <input
            name="path"
            defaultValue={path}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="field h-11 px-3.5 md:h-10"
          />
        </label>
        <Button type="submit" variant="outline" className="h-11 md:h-9">
          {l.apply}
        </Button>
        {filtered ? (
          <Link
            href="/logs"
            className="inline-flex h-11 items-center px-2 text-sm text-muted-foreground hover:text-foreground md:h-9"
          >
            {l.reset}
          </Link>
        ) : null}
      </form>

      {entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filtered ? l.noMatchTitle : l.emptyTitle}
          description={filtered ? l.noMatchText : l.emptyText}
        />
      ) : (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-normal">{l.time}</th>
                <th className="px-4 py-2 font-normal">{l.host}</th>
                <th className="px-4 py-2 font-normal">{l.request}</th>
                <th className="px-4 py-2 text-right font-normal">{l.status}</th>
                <th className="px-4 py-2 text-right font-normal">
                  {l.duration}
                </th>
                <th className="px-4 py-2 text-right font-normal">{l.size}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {entries.map((entry) => {
                const statusClass =
                  `${Math.floor(entry.status / 100)}xx` as StatusClass;
                return (
                  <tr key={entry.id} className="border-t">
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                      <time dateTime={new Date(entry.ts).toISOString()}>
                        {formatLogTime(entry.ts, locale)}
                      </time>
                    </td>
                    <td className="px-4 py-2 [overflow-wrap:anywhere]">
                      {entry.host}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs [overflow-wrap:anywhere]">
                      <span className="text-muted-foreground">
                        {entry.method}
                      </span>{" "}
                      {entry.path}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${STATUS_TONE[statusClass] ?? ""}`}
                    >
                      {entry.status}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatMs(entry.durationMs, locale)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatBytes(entry.bytes, locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {older ? (
        <Link
          href={{ pathname: "/logs", query: older }}
          className="inline-flex min-h-11 w-fit items-center text-sm text-muted-foreground hover:text-foreground md:min-h-8"
        >
          {l.older}
        </Link>
      ) : null}
    </div>
  );
}
