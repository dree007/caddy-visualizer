"use client";

import { RefreshCw, RotateCw } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  recheckApplyStatusAction,
  retryApplyAction,
} from "@/server/caddy/apply-actions";
import { translateCode } from "@/i18n";
import { useI18n } from "@/i18n/client";

import { applySentence } from "./sync-labels";

/** Buttons of the sync status panel; the result re-renders the page. */
export function SyncActions({
  retry,
  recheck,
  retryLabel,
}: {
  retry?: boolean;
  recheck?: boolean;
  retryLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<"retry" | "recheck" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { t } = useI18n();

  function run(kind: "retry" | "recheck") {
    setRunning(kind);
    setMessage(null);
    startTransition(async () => {
      if (kind === "retry") {
        const outcome = await retryApplyAction();
        setMessage(
          outcome.message
            ? translateCode(t, outcome.message)
            : applySentence(t, outcome).text,
        );
      } else {
        await recheckApplyStatusAction();
      }
      setRunning(null);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        {retry ? (
          <Button
            className="max-md:h-11"
            disabled={pending}
            onClick={() => run("retry")}
          >
            {running === "retry" ? (
              <Spinner aria-hidden />
            ) : (
              <RotateCw aria-hidden data-icon="inline-start" />
            )}
            {running === "retry"
              ? t.common.applying
              : (retryLabel ?? t.common.retry)}
          </Button>
        ) : null}
        {recheck ? (
          <Button
            variant="outline"
            className="max-md:h-11"
            disabled={pending}
            onClick={() => run("recheck")}
          >
            {running === "recheck" ? (
              <Spinner aria-hidden />
            ) : (
              <RefreshCw aria-hidden data-icon="inline-start" />
            )}
            {t.config.syncDetail.checkStatus}
          </Button>
        ) : null}
      </div>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
