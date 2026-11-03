import type { Locale, Messages } from "@/i18n";
import { formatCount } from "@/lib/format";
import type { CertificateSummary } from "@/modules/certificates/status";
import { cn } from "@/lib/utils";

/** Three small counters: valid, expiring soon, expired or faulty. */
export function CertificateSummaryTiles({
  summary,
  locale,
  t,
}: {
  summary: CertificateSummary;
  locale: Locale;
  t: Messages;
}) {
  const s = t.certificates.summary;
  const tiles = [
    {
      key: "valid",
      label: s.valid,
      value: summary.valid,
      dot: "bg-(--viz-good)",
    },
    {
      key: "expiring",
      label: s.expiring,
      value: summary.expiring,
      dot: "bg-(--viz-warning)",
    },
    {
      key: "problems",
      label: s.problems,
      value: summary.problems,
      dot: "bg-(--viz-critical)",
    },
  ] as const;
  return (
    <dl className="grid grid-cols-3 gap-2 md:gap-4">
      {tiles.map((tile) => (
        <div
          key={tile.key}
          className="surface-band flex min-w-0 flex-col gap-1.5 p-4 md:p-5"
        >
          <dt className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className={cn("mt-1 size-1.5 shrink-0 rounded-full", tile.dot)}
            />
            <span className="leading-tight">{tile.label}</span>
          </dt>
          <dd
            className={cn(
              "font-display text-2xl leading-none font-light tabular-nums md:text-3xl",
              tile.key === "problems" && tile.value > 0 && "text-destructive",
            )}
          >
            {formatCount(tile.value, locale)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
