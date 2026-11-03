import type { Candidate, NotApplicableReason } from "./candidates";
import type { CertificateCheck } from "./store";

/*
 * Display status of a host name, derived at read time from its last check:
 * a certificate valid at check time may be expiring or expired by now.
 */

export const CERTIFICATE_STATUSES = [
  "valid",
  "expiring",
  "expired",
  "invalid",
  "unreachable",
  "not-checked",
  "not-applicable",
] as const;

export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export const EXPIRY_WARNING_DAYS = 30;
export const EXPIRY_CRITICAL_DAYS = 7;

const DAY_MS = 86_400_000;

export interface CertificateView {
  hostname: string;
  status: CertificateStatus;
  /** Expiring within `EXPIRY_CRITICAL_DAYS`. */
  critical: boolean;
  /** Whole days until `validTo`, negative once expired. */
  daysLeft: number | null;
  reason: NotApplicableReason | "blocked" | null;
  /** Message code of the last check. */
  error: string | null;
  check: CertificateCheck | null;
}

export function certificateView(
  candidate: Candidate,
  check: CertificateCheck | null,
  now: Date,
): CertificateView {
  const base = {
    hostname: candidate.hostname,
    critical: false,
    daysLeft: null,
    reason: null,
    error: null,
    check: null,
  } satisfies Partial<CertificateView>;
  if (!candidate.checkable) {
    return { ...base, status: "not-applicable", reason: candidate.reason };
  }
  if (!check) return { ...base, status: "not-checked" };

  const daysLeft = check.validTo
    ? Math.floor((check.validTo.getTime() - now.getTime()) / DAY_MS)
    : null;
  const view = { ...base, daysLeft, error: check.error, check };
  switch (check.outcome) {
    case "blocked":
      return { ...view, status: "not-applicable", reason: "blocked" };
    case "unreachable":
      return { ...view, status: "unreachable" };
    case "expired":
      return { ...view, status: "expired" };
    case "invalid":
      return { ...view, status: "invalid" };
  }
  // Valid at check time: only the date can have changed since.
  if (!check.validTo || check.validTo <= now) {
    return { ...view, status: "expired" };
  }
  if (daysLeft !== null && daysLeft <= EXPIRY_WARNING_DAYS) {
    return {
      ...view,
      status: "expiring",
      critical: daysLeft <= EXPIRY_CRITICAL_DAYS,
    };
  }
  return { ...view, status: "valid" };
}

export interface CertificateSummary {
  valid: number;
  expiring: number;
  /** Expired, invalid or unreachable. */
  problems: number;
}

export function summarize(
  views: readonly CertificateView[],
): CertificateSummary {
  const summary: CertificateSummary = { valid: 0, expiring: 0, problems: 0 };
  for (const view of views) {
    if (view.status === "valid") summary.valid++;
    else if (view.status === "expiring") summary.expiring++;
    else if (
      view.status === "expired" ||
      view.status === "invalid" ||
      view.status === "unreachable"
    )
      summary.problems++;
  }
  return summary;
}
