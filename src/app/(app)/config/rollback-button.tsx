"use client";

import { CircleAlert, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { translateCode } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { rollbackRevisionAction } from "@/server/caddy/apply-actions";

const MAX_LISTED = 8;

export function RollbackButton({
  revisionId,
  revisionNumber,
  createdLabel,
  sites,
  restoresMain,
}: {
  revisionId: string;
  revisionNumber: number;
  createdLabel: string;
  sites: { hostname: string; enabled: boolean }[];
  /** The revision holds a Caddyfile snapshot, which is restored too. */
  restoresMain: boolean;
}) {
  const enabledCount = sites.filter((site) => site.enabled).length;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { t } = useI18n();
  const r = t.config.rollback;

  function confirm() {
    setError(null);
    startTransition(async () => {
      const outcome = await rollbackRevisionAction(revisionId);
      if (outcome.state === "applied") setOpen(false);
      else
        setError(
          outcome.message ? translateCode(t, outcome.message) : r.failed,
        );
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="shrink-0 max-md:h-11">
          <Undo2 aria-hidden data-icon="inline-start" />
          {r.button}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{r.title(revisionNumber)}</AlertDialogTitle>
          <AlertDialogDescription>
            {r.text(createdLabel)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="surface-band flex flex-col gap-2 rounded-2xl p-4 text-sm">
          <p className="font-medium">{r.summary(sites.length, enabledCount)}</p>
          {sites.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {sites.slice(0, MAX_LISTED).map((site) => (
                <li
                  key={site.hostname}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {site.hostname}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {site.enabled ? r.enabled : r.disabled}
                  </span>
                </li>
              ))}
              {sites.length > MAX_LISTED ? (
                <li className="text-muted-foreground">
                  {r.more(sites.length - MAX_LISTED)}
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-muted-foreground">{r.none}</p>
          )}
          {restoresMain ? (
            <p className="text-muted-foreground">{r.restoresMain}</p>
          ) : null}
        </div>
        {error ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t.common.cancel}
          </AlertDialogCancel>
          <Button disabled={pending} onClick={confirm}>
            {pending ? (
              <>
                <Spinner aria-hidden /> {t.common.applying}
              </>
            ) : (
              r.button
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
