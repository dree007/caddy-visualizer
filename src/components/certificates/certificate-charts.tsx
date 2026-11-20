import type { Locale, Messages } from "@/i18n";
import { formatCount, formatDate, formatPercent } from "@/lib/format";
import {
  byExpiry,
  CERTIFICATE_STATUSES,
  type CertificateStatus,
  type CertificateView,
  countByStatus,
  EXPIRY_CRITICAL_DAYS,
  EXPIRY_WARNING_DAYS,
} from "@/modules/certificates/status";

/** Chart color per status; the status is always named in text as well. */
const COLORS: Record<CertificateStatus, string> = {
  valid: "var(--viz-good)",
  expiring: "var(--ember)",
  expired: "var(--viz-critical)",
  invalid: "var(--viz-critical)",
  unreachable: "var(--viz-critical)",
  "not-checked": "var(--viz-neutral)",
  "not-applicable": "var(--viz-grid)",
};

const colorOf = (view: Pick<CertificateView, "status" | "critical">) =>
  view.critical ? "var(--viz-critical)" : COLORS[view.status];

/** Part-to-whole bar of all host names by status; the legend carries the values. */
export function CertificateStatusDistribution({
  views,
  locale,
  t,
}: {
  views: readonly CertificateView[];
  locale: Locale;
  t: Messages;
}) {
  const c = t.certificates;
  const counts = countByStatus(views);
  const present = CERTIFICATE_STATUSES.filter((status) => counts[status] > 0);
  return (
    <section
      aria-labelledby="cert-status-heading"
      className="surface flex flex-col gap-5 p-5 md:p-7"
    >
      <h2 id="cert-status-heading" className="heading">
        {c.charts.statusTitle}
      </h2>
      <div
        aria-hidden
        className="flex h-3 overflow-hidden rounded-full bg-stone"
      >
        {present.map((status) => (
          <span
            key={status}
            className="h-full"
            style={{
              width: `${(counts[status] / views.length) * 100}%`,
              minWidth: 4,
              background: COLORS[status],
            }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        {present.map((status) => (
          <li key={status} className="flex min-w-0 items-start gap-2.5">
            <span
              aria-hidden
              className="mt-1.5 size-2 shrink-0 rounded-full"
              style={{ background: COLORS[status] }}
            />
            <span className="flex min-w-0 flex-col">
              <span>{c.statuses[status]}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatCount(counts[status], locale)} ·{" "}
                {formatPercent(counts[status], views.length, locale)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Remaining validity per certificate, soonest expiry first, on a shared day
 * scale with marks at the warning thresholds. Every value is also in text.
 */
export function CertificateExpiryChart({
  views,
  locale,
  t,
}: {
  views: readonly CertificateView[];
  locale: Locale;
  t: Messages;
}) {
  const c = t.certificates;
  const rows = byExpiry(views);
  const scale = Math.max(
    EXPIRY_WARNING_DAYS,
    ...rows.map((view) => view.daysLeft),
  );
  const at = (days: number) =>
    `${(Math.min(Math.max(days, 0), scale) / scale) * 100}%`;

  return (
    <section
      aria-labelledby="cert-expiry-heading"
      className="surface flex flex-col gap-5 p-5 md:p-7"
    >
      <div className="flex flex-col gap-1">
        <h2 id="cert-expiry-heading" className="heading">
          {c.charts.expiryTitle}
        </h2>
        <p className="text-xs text-muted-foreground">
          {c.charts.expiryNote(EXPIRY_CRITICAL_DAYS, EXPIRY_WARNING_DAYS)}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{c.charts.expiryEmpty}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-3.5">
            {rows.map((view) => (
              <li key={view.hostname} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="mono min-w-0 truncate font-medium">
                    {view.hostname}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {c.daysLeft(view.daysLeft)} ·{" "}
                    {formatDate(view.check.validTo, locale, {
                      dateStyle: "medium",
                    })}
                  </span>
                </div>
                <div
                  aria-hidden
                  className="relative h-1.5 rounded-sm bg-muted"
                  data-status={view.status}
                >
                  <span
                    className="absolute inset-y-0 left-0 rounded-sm"
                    style={{
                      width: at(view.daysLeft),
                      minWidth: 4,
                      background: colorOf(view),
                    }}
                  />
                  {[EXPIRY_CRITICAL_DAYS, EXPIRY_WARNING_DAYS].map((days) => (
                    <span
                      key={days}
                      className="absolute -inset-y-1 w-px bg-foreground/30"
                      style={{ left: at(days) }}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div
            aria-hidden
            className="relative h-4 text-[0.6875rem] text-muted-foreground tabular-nums"
          >
            <span className="absolute left-0">{c.charts.today}</span>
            {EXPIRY_WARNING_DAYS / scale <= 0.7 ? (
              <span
                className="absolute -translate-x-1/2"
                style={{ left: at(EXPIRY_WARNING_DAYS) }}
              >
                {c.charts.days(EXPIRY_WARNING_DAYS)}
              </span>
            ) : null}
            <span className="absolute right-0">{c.charts.days(scale)}</span>
          </div>
        </>
      )}
    </section>
  );
}
