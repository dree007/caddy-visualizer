"use client";

import {
  ArrowRight,
  CircleAlert,
  KeyRound,
  Lock,
  LockOpen,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import type { TlsMode } from "@/modules/caddy/tls";
import {
  deleteSiteAction,
  setSiteEnabledAction,
} from "@/server/caddy/site-actions";
import type { SiteActionResult } from "@/server/caddy/site-form";
import { type Messages, translateCode } from "@/i18n";
import { useI18n } from "@/i18n/client";

import {
  applySentence,
  type Tone,
  TONE_BORDERS,
  TONE_CLASSES,
  TONE_ICONS,
} from "./sync-labels";

/** View model of a site; only what the list renders. */
export interface SiteListItem {
  id: string;
  hostname: string;
  upstream: string;
  tls: TlsMode;
  /** Protected by basic auth (never the credentials themselves). */
  basicAuth: boolean;
  enabled: boolean;
  /** ISO timestamp, for `<time dateTime>`. */
  updatedAt: string;
  /** Formatted on the server. */
  updatedLabel: string;
}

type Feedback = { tone: Tone; text: string };

/**
 * One markup for all sizes: a card list on phones, denser cards on tablets and
 * a table-like grid (CSS subgrid) on desktops. Same data and actions everywhere.
 */
export function SiteList({ sites }: { sites: SiteListItem[] }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const { t } = useI18n();
  const l = t.config.list;

  return (
    <div className="flex flex-col gap-3">
      <div aria-live="polite" aria-atomic>
        {feedback ? <FeedbackAlert feedback={feedback} /> : null}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_auto_auto_auto_auto] lg:overflow-hidden lg:rounded-3xl lg:bg-card lg:shadow-soft-md">
        <div
          aria-hidden
          className="eyebrow hidden px-6 pt-5 pb-3 lg:col-span-full lg:grid lg:grid-cols-subgrid lg:gap-x-6"
        >
          <span>{l.hostname}</span>
          <span>{l.upstream}</span>
          <span>{l.tls}</span>
          <span>{l.changed}</span>
          <span>{l.status}</span>
          <span />
        </div>
        <ul className="flex flex-col gap-3 lg:col-span-full lg:grid lg:grid-cols-subgrid lg:gap-0">
          {sites.map((site) => (
            <SiteRow key={site.id} site={site} onFeedback={setFeedback} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function SiteRow({
  site,
  onFeedback,
}: {
  site: SiteListItem;
  onFeedback: (feedback: Feedback) => void;
}) {
  const [enabled, setOptimisticEnabled] = useOptimistic(site.enabled);
  const [pending, startTransition] = useTransition();
  const switchId = `site-enabled-${site.id}`;
  const { t } = useI18n();
  const l = t.config.list;

  function toggle(next: boolean) {
    startTransition(async () => {
      setOptimisticEnabled(next);
      const result = await setSiteEnabledAction(site.id, next);
      onFeedback(feedbackFor(t, result, l.enabledNotice(site.hostname, next)));
    });
  }

  const TlsIcon = site.tls === "off" ? LockOpen : Lock;

  return (
    <li
      data-enabled={enabled}
      aria-busy={pending || undefined}
      className={[
        "surface grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 p-5",
        "[grid-template-areas:'host_host'_'upstream_upstream'_'tls_updated'_'toggle_actions']",
        "md:grid-cols-[minmax(0,1fr)_auto_auto] md:gap-x-6 md:[grid-template-areas:'host_tls_toggle'_'upstream_updated_actions']",
        "lg:col-span-full lg:grid-cols-subgrid lg:rounded-none lg:border-t lg:bg-transparent lg:px-6 lg:py-3 lg:shadow-none lg:[grid-template-areas:none]",
      ].join(" ")}
    >
      <p
        className={`min-w-0 font-medium [overflow-wrap:anywhere] [grid-area:host] lg:[grid-area:auto] ${enabled ? "" : "text-muted-foreground"}`}
      >
        {site.hostname}
      </p>

      <p className="flex min-w-0 items-center gap-1.5 font-mono text-sm text-muted-foreground [grid-area:upstream] lg:[grid-area:auto]">
        <ArrowRight aria-hidden className="size-3.5 shrink-0 lg:hidden" />
        <span className="sr-only">{l.upstream}: </span>
        <span className="min-w-0 break-all">{site.upstream}</span>
      </p>

      <div className="flex flex-wrap gap-1.5 [grid-area:tls] lg:[grid-area:auto]">
        <Badge variant="outline" className="text-muted-foreground">
          <TlsIcon aria-hidden data-icon="inline-start" />
          {t.config.tls[site.tls].short}
        </Badge>
        {site.basicAuth ? (
          <Badge variant="outline" className="text-muted-foreground">
            <KeyRound aria-hidden data-icon="inline-start" />
            {l.basicAuth}
          </Badge>
        ) : null}
      </div>

      <p className="text-right text-xs text-muted-foreground [grid-area:updated] md:text-left lg:[grid-area:auto]">
        <span className="lg:sr-only">{l.changed} </span>
        <time dateTime={site.updatedAt}>{site.updatedLabel}</time>
      </p>

      {/* The label makes the whole status area a ≥44px touch target. */}
      <label
        htmlFor={switchId}
        className="flex min-h-11 w-fit cursor-pointer items-center gap-2.5 text-sm [grid-area:toggle] lg:[grid-area:auto]"
      >
        <Switch
          id={switchId}
          checked={enabled}
          onCheckedChange={toggle}
          disabled={pending}
          aria-label={l.activeLabel(site.hostname)}
        />
        <span className="flex items-center gap-1.5">
          {pending ? (
            <Spinner aria-hidden className="size-3" />
          ) : (
            <span
              aria-hidden
              className={`size-2 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
            />
          )}
          <span className={enabled ? "" : "text-muted-foreground"}>
            {enabled ? l.active : l.inactive}
          </span>
        </span>
      </label>

      <div className="flex items-center justify-end gap-1 [grid-area:actions] lg:[grid-area:auto]">
        <Button asChild variant="outline" className="max-md:h-11 lg:hidden">
          <Link href={`/config/${site.id}/edit`}>
            <Pencil aria-hidden data-icon="inline-start" />
            {l.edit}
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="hidden lg:inline-flex"
        >
          <Link
            href={`/config/${site.id}/edit`}
            aria-label={l.editLabel(site.hostname)}
            title={l.edit}
          >
            <Pencil aria-hidden />
          </Link>
        </Button>
        <DeleteSiteDialog site={site} onFeedback={onFeedback} />
      </div>
    </li>
  );
}

function DeleteSiteDialog({
  site,
  onFeedback,
}: {
  site: SiteListItem;
  onFeedback: (feedback: Feedback) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { t } = useI18n();
  const l = t.config.list;

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteSiteAction(site.id);
      if (result.ok) {
        setOpen(false);
        onFeedback(feedbackFor(t, result, l.deletedNotice(site.hostname)));
      } else {
        setError(result.message);
      }
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
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive max-md:size-11"
          aria-label={l.deleteLabel(site.hostname)}
          title={t.common.delete}
        >
          <Trash2 aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>{l.deleteTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium break-all text-foreground">
              {site.hostname}
            </span>{" "}
            {l.deleteText}
          </AlertDialogDescription>
        </AlertDialogHeader>

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
          {/* A plain button: the dialog must stay open while deleting. */}
          <Button
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={pending}
            onClick={confirmDelete}
          >
            {pending ? (
              <>
                <Spinner aria-hidden /> {t.common.deleting}
              </>
            ) : (
              t.common.delete
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** What was saved, plus what Caddy did with it. */
function feedbackFor(
  t: Messages,
  result: SiteActionResult,
  saved: string,
): Feedback {
  if (!result.ok) return { tone: "error", text: result.message };
  const apply = applySentence(t, result.apply);
  const detail =
    result.apply.state === "failed" && result.apply.message
      ? ` ${translateCode(t, result.apply.message)}`
      : "";
  return { tone: apply.tone, text: `${saved} ${apply.text}${detail}` };
}

function FeedbackAlert({ feedback }: { feedback: Feedback }) {
  const Icon = TONE_ICONS[feedback.tone];
  return (
    <Alert
      role={feedback.tone === "error" ? "alert" : "status"}
      className={TONE_BORDERS[feedback.tone]}
    >
      <Icon aria-hidden className={TONE_CLASSES[feedback.tone]} />
      <AlertDescription className="text-foreground">
        {feedback.text}
      </AlertDescription>
    </Alert>
  );
}
