import { Settings, ShieldCheck } from "lucide-react";

import { DesignSection } from "@/components/design/design-section";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getI18n } from "@/i18n/server";
import { requireAccess } from "@/server/auth/session";

import { CaddyStatusCard } from "./caddy-status-card";
import { IngestionCard } from "./ingestion-card";

export default async function SettingsPage() {
  const access = await requireAccess();
  const { t } = await getI18n();
  return (
    <div className="flex flex-col gap-6">
      {access.mode === "proxy" ? (
        <Alert>
          <ShieldCheck aria-hidden />
          <AlertDescription>{t.settings.proxyAuth}</AlertDescription>
        </Alert>
      ) : null}
      <CaddyStatusCard />
      <IngestionCard />
      <DesignSection />
      <EmptyState
        icon={Settings}
        title={t.settings.moreTitle}
        description={t.settings.moreText}
      />
    </div>
  );
}
