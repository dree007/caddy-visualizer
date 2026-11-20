import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { DesignSection } from "@/components/design/design-section";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getI18n } from "@/i18n/server";
import { requireAccess } from "@/server/auth/session";

import { CaddyStatusCard } from "./caddy-status-card";
import { IngestionCard } from "./ingestion-card";
import { getDesign } from "@/server/design";

import ClassicSettingsPage from "./classic/classic-page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.settings.title };
}

async function SchematicSettingsPage() {
  const access = await requireAccess();
  const { t } = await getI18n();
  return (
    <div className="flex flex-col gap-5 md:gap-7">
      {access.mode === "proxy" ? (
        <Alert>
          <ShieldCheck aria-hidden />
          <AlertDescription>{t.settings.proxyAuth}</AlertDescription>
        </Alert>
      ) : null}
      <CaddyStatusCard />
      <IngestionCard />
      <DesignSection />
      <section
        aria-labelledby="more-settings"
        className="surface-band flex flex-col gap-1 p-5 md:p-7"
      >
        <h2 id="more-settings" className="heading">
          {t.settings.moreTitle}
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          {t.settings.moreText}
        </p>
      </section>
    </div>
  );
}

/** "Klassisch" is the page as on main; "Schaltplan" is the redesign. */
export default async function SettingsPage() {
  if ((await getDesign()) === "classic") return ClassicSettingsPage();
  return SchematicSettingsPage();
}
