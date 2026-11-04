import { Settings, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getI18n } from "@/i18n/server";
import { requireAccess } from "@/server/auth/session";

import { CaddyStatusCard } from "./caddy-status-card";
import { IngestionCard } from "./ingestion-card";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.settings.title };
}

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
      <EmptyState
        icon={Settings}
        title={t.settings.moreTitle}
        description={t.settings.moreText}
      />
    </div>
  );
}
