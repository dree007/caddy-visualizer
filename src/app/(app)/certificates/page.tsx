import { CircleAlert, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { CertificateSummaryTiles } from "@/components/certificates/certificate-summary";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { translateCode } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { formatDateTime } from "@/lib/format";
import { summarize } from "@/modules/certificates/status";
import { loadCertificateOverview } from "@/server/certificates/checks";

import { CertificateList } from "./certificate-list";
import { CheckNow } from "./check-now";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.certificates.title };
}

export default async function CertificatesPage() {
  const [overview, { locale, t }] = await Promise.all([
    loadCertificateOverview(),
    getI18n(),
  ]);
  const c = t.certificates;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {overview.running
              ? c.runningNote
              : overview.lastCheckedAt
                ? c.lastRun(formatDateTime(overview.lastCheckedAt, locale))
                : c.neverRun}
          </p>
          <p className="max-w-prose text-xs text-muted-foreground">
            {c.observedNote}
          </p>
        </div>
        {overview.state === "not-configured" ? null : (
          <CheckNow running={overview.running} />
        )}
      </div>

      {overview.state === "ok" ? null : (
        <Alert
          variant={overview.state === "unreachable" ? "destructive" : "default"}
        >
          <CircleAlert aria-hidden />
          <AlertDescription>
            {overview.state === "unreachable" && overview.message
              ? `${translateCode(t, overview.message)} ${c.caddyUnreachable}`
              : t.common.notConfigured}
          </AlertDescription>
        </Alert>
      )}

      {overview.views.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={c.emptyTitle}
          description={c.emptyText}
        />
      ) : (
        <>
          <CertificateSummaryTiles
            summary={summarize(overview.views)}
            locale={locale}
            t={t}
          />
          <CertificateList views={overview.views} locale={locale} t={t} />
        </>
      )}
    </div>
  );
}
