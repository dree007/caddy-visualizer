"use client";

import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { translateCode } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { checkCertificatesAction } from "@/server/certificates/actions";

/** “Check now”; the action revalidates the page with the new results. */
export function CheckNow({ running }: { running: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const { t } = useI18n();
  const busy = pending || running;

  function check() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await checkCertificatesAction();
        setMessage({ ok: result.ok, text: translateCode(t, result.message) });
      } catch {
        setMessage({ ok: false, text: t.certificates.errorTitle });
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
      <Button
        variant="outline"
        className="max-md:h-11"
        disabled={busy}
        onClick={check}
      >
        {busy ? (
          <Spinner aria-hidden />
        ) : (
          <RefreshCw aria-hidden data-icon="inline-start" />
        )}
        {busy ? t.certificates.checking : t.certificates.checkNow}
      </Button>
      <p
        aria-live="polite"
        className={
          message && !message.ok
            ? "text-sm text-destructive"
            : "text-sm text-muted-foreground"
        }
      >
        {message?.text}
      </p>
    </div>
  );
}
