import { Settings } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/server/auth/session";

import { CaddyStatusCard } from "./caddy-status-card";
import { IngestionCard } from "./ingestion-card";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.settings.title };
}

export default async function SettingsPage() {
  await requireSession();
  const { t } = await getI18n();
  return (
    <div className="flex flex-col gap-6">
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
