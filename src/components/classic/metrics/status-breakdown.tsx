import {
  CircleCheck,
  CircleX,
  CornerUpRight,
  type LucideIcon,
  TriangleAlert,
} from "lucide-react";

import { getI18n } from "@/i18n/server";
import { formatCount, formatPercent } from "@/lib/format";
import {
  type MetricsTotals,
  STATUS_CLASSES,
  type StatusClass,
} from "@/modules/access-log/queries";

/** Fixed status colors; always shown together with icon and label. */
export const STATUS: Record<StatusClass, { color: string; icon: LucideIcon }> =
  {
    "2xx": { color: "var(--viz-good)", icon: CircleCheck },
    "3xx": { color: "var(--viz-neutral)", icon: CornerUpRight },
    "4xx": { color: "var(--viz-warning)", icon: TriangleAlert },
    "5xx": { color: "var(--viz-critical)", icon: CircleX },
  };

/** Part-to-whole bar of status classes; the legend carries icon, label and value. */
export async function StatusBreakdown({ totals }: { totals: MetricsTotals }) {
  const { locale, t } = await getI18n();
  const total = STATUS_CLASSES.reduce((sum, c) => sum + totals.byClass[c], 0);
  if (total === 0) {
    return (
      <p className="surface p-5 text-sm text-muted-foreground md:p-7">
        {t.metrics.status.empty}
      </p>
    );
  }
  return (
    <div className="surface flex flex-col gap-5 p-5 md:p-7">
      <div aria-hidden className="flex h-3 gap-[2px]">
        {STATUS_CLASSES.filter((c) => totals.byClass[c] > 0).map((c) => (
          <span
            key={c}
            className="h-full rounded-full"
            style={{
              width: `${(totals.byClass[c] / total) * 100}%`,
              minWidth: 6,
              background: STATUS[c].color,
            }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        {STATUS_CLASSES.map((c) => {
          const Icon = STATUS[c].icon;
          return (
            <li key={c} className="flex min-w-0 items-start gap-2.5">
              <Icon
                aria-hidden
                className="mt-0.5 size-4 shrink-0"
                strokeWidth={1.75}
                style={{ color: STATUS[c].color }}
              />
              <span className="flex min-w-0 flex-col">
                <span>
                  {c} · {t.metrics.status[c]}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {formatCount(totals.byClass[c], locale)} ·{" "}
                  {formatPercent(totals.byClass[c], total, locale)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
