import { SearchX } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";

export default async function SiteNotFound() {
  const { t } = await getI18n();
  return (
    <EmptyState
      icon={SearchX}
      title={t.config.notFound.title}
      description={t.config.notFound.text}
    >
      <Button asChild>
        <Link href="/config">{t.common.backToOverview}</Link>
      </Button>
    </EmptyState>
  );
}
