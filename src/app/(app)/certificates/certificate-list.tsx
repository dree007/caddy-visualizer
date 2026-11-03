import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { CertificateStatusBadge } from "@/components/certificates/certificate-status";
import { type Locale, type Messages, translateCode } from "@/i18n";
import { formatDate, formatDateTime } from "@/lib/format";
import type { CertificateView } from "@/modules/certificates/status";

/**
 * One card per host name; a click (or Enter) opens its details. Native
 * `<details>` keeps it working without JavaScript and on every screen size.
 */
export function CertificateList({
  views,
  locale,
  t,
}: {
  views: CertificateView[];
  locale: Locale;
  t: Messages;
}) {
  const c = t.certificates;
  const date = (value: Date | null | undefined) =>
    value ? formatDate(value, locale, { dateStyle: "medium" }) : "–";
  const dateTime = (value: Date | null | undefined) =>
    value ? formatDateTime(value, locale) : c.never;

  return (
    <ul aria-label={c.listLabel} className="flex flex-col gap-3">
      {views.map((view) => {
        const check = view.check;
        const problem = view.error ? translateCode(t, view.error) : null;
        const reason =
          view.reason && view.reason !== "blocked"
            ? c.reasons[view.reason]
            : null;
        return (
          <li key={view.hostname} id={`cert-${view.hostname}`}>
            <details className="surface group">
              <summary
                aria-label={c.details(view.hostname)}
                className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[inherit] p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:px-5 [&::-webkit-details-marker]:hidden"
              >
                <span className="min-w-0 flex-1 basis-48 text-sm font-medium [overflow-wrap:anywhere]">
                  {view.hostname}
                </span>
                <span className="flex items-center gap-2">
                  {view.daysLeft !== null &&
                  (view.status === "valid" ||
                    view.status === "expiring" ||
                    view.status === "expired") ? (
                    <span
                      className={
                        view.critical || view.status === "expired"
                          ? "text-xs font-medium text-destructive tabular-nums"
                          : "text-xs text-muted-foreground tabular-nums"
                      }
                    >
                      {c.daysLeft(view.daysLeft)}
                    </span>
                  ) : null}
                  <CertificateStatusBadge view={view} t={t} />
                  <ChevronDown
                    aria-hidden
                    className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                  />
                </span>
              </summary>
              <div className="flex flex-col gap-3 border-t border-border/60 px-4 pt-3 pb-4 text-sm md:px-5">
                {reason || problem ? (
                  <p
                    className={
                      view.status === "not-applicable"
                        ? "text-muted-foreground"
                        : "text-destructive"
                    }
                  >
                    {[reason, problem].filter(Boolean).join(" ")}
                  </p>
                ) : null}
                {view.reason === "blocked" ? (
                  <p className="text-muted-foreground">{c.privateHelp}</p>
                ) : null}
                {view.status === "not-applicable" &&
                view.reason !== "blocked" ? null : (
                  <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
                    <Field label={c.fields.issuer}>
                      {check?.issuer ?? "–"}
                    </Field>
                    <Field label={c.fields.subject}>
                      {check?.subject ?? "–"}
                    </Field>
                    <Field label={c.fields.validFrom}>
                      {date(check?.validFrom)}
                    </Field>
                    <Field label={c.fields.validTo}>
                      {date(check?.validTo)}
                    </Field>
                    <Field label={c.fields.daysLeft}>
                      {view.daysLeft === null ? "–" : c.daysLeft(view.daysLeft)}
                    </Field>
                    <Field label={c.fields.sans}>
                      {check?.sans?.length ? (
                        <span className="font-mono text-xs">
                          {check.sans.join(", ")}
                        </span>
                      ) : (
                        "–"
                      )}
                    </Field>
                    <Field label={c.fields.address}>
                      <span className="font-mono text-xs">
                        {check?.address ?? "–"}
                      </span>
                    </Field>
                    <Field label={c.fields.lastSuccess}>
                      {dateTime(check?.lastSuccessAt)}
                    </Field>
                    <Field label={c.fields.lastAttempt}>
                      {dateTime(check?.checkedAt)}
                    </Field>
                    {check?.fingerprint256 ? (
                      <Field label={c.fields.fingerprint}>
                        <span className="font-mono text-xs">
                          {check.fingerprint256}
                        </span>
                      </Field>
                    ) : null}
                  </dl>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground max-sm:mt-1.5">{label}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere]">{children}</dd>
    </>
  );
}
