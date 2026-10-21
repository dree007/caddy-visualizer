"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useI18n } from "@/i18n/client";
import { RANGES, type Range } from "@/modules/access-log/queries";

/** One row above everything it scopes: time range first, then host. */
export function MetricsFilters({
  range,
  host,
  hosts,
}: {
  range: Range;
  host: string | null;
  hosts: string[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const href = (next: { range?: Range; host?: string | null }) => {
    const params = new URLSearchParams();
    params.set("range", next.range ?? range);
    const h = next.host === undefined ? host : next.host;
    if (h) params.set("host", h);
    return `/metrics?${params.toString()}`;
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label={t.metrics.range} className="surface-pressed flex p-1">
        {RANGES.map((r) => (
          <Link
            key={r}
            href={href({ range: r })}
            aria-current={r === range ? "page" : undefined}
            className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-[color,background-color,box-shadow] duration-200 hover:text-foreground aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-soft-sm md:min-h-8"
          >
            {t.metrics.ranges[r]}
          </Link>
        ))}
      </nav>
      <label className="sr-only" htmlFor="metrics-host">
        {t.metrics.host}
      </label>
      <select
        id="metrics-host"
        value={host ?? ""}
        onChange={(event) =>
          router.push(href({ host: event.target.value || null }))
        }
        className="field h-11 max-w-full min-w-0 px-3.5 text-sm md:h-10"
      >
        <option value="">{t.metrics.allHosts}</option>
        {host && !hosts.includes(host) ? (
          <option value={host}>{host}</option>
        ) : null}
        {hosts.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}
