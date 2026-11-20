import {
  CircleDashed,
  CircleMinus,
  Clock,
  type LucideIcon,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Unplug,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Messages } from "@/i18n";
import type {
  CertificateStatus,
  CertificateView,
} from "@/modules/certificates/status";

const ICONS: Record<CertificateStatus, LucideIcon> = {
  valid: ShieldCheck,
  expiring: Clock,
  expired: ShieldX,
  invalid: ShieldAlert,
  unreachable: Unplug,
  "not-checked": CircleDashed,
  "not-applicable": CircleMinus,
};

/** Dot color per status; icon and label carry the meaning as well. */
const DOTS: Partial<Record<CertificateStatus, string>> = {
  valid: "bg-(--viz-good)",
  expiring: "bg-(--viz-warning)",
  unreachable: "bg-(--viz-critical)",
};

/** Calm by default; expired, invalid and the last week before expiry stand out. */
export function CertificateStatusBadge({
  view,
  t,
}: {
  view: Pick<CertificateView, "status" | "critical">;
  t: Messages;
}) {
  const Icon = ICONS[view.status];
  const variant =
    view.status === "expired" || view.status === "invalid"
      ? "destructive"
      : view.critical
        ? "ember"
        : view.status === "not-checked" || view.status === "not-applicable"
          ? "secondary"
          : "outline";
  const dot = view.critical ? undefined : DOTS[view.status];
  return (
    <Badge variant={variant} data-status={view.status}>
      {dot ? (
        <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
      ) : (
        <Icon aria-hidden data-icon="inline-start" />
      )}
      {t.certificates.statuses[view.status]}
    </Badge>
  );
}
