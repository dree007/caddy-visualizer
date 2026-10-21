"use client";

import { CircleAlert, RotateCw } from "lucide-react";
import { useEffect } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

/** Loading the sites failed (e.g. database unavailable). Details stay in the server log. */
export default function ConfigError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={CircleAlert}
      title={t.config.error.title}
      description={t.config.error.text}
    >
      <Button onClick={() => retry()}>
        <RotateCw aria-hidden data-icon="inline-start" />
        {t.common.retry}
      </Button>
    </EmptyState>
  );
}
