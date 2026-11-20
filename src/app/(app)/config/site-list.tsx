"use client";

import {
  ArrowRight,
  CornerUpRight,
  CircleAlert,
  KeyRound,
  ListPlus,
  Network,
  Lock,
  LockOpen,
  Pencil,
  ShieldOff,
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

import { NewRouteRow } from "./new-route-row";
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
  /** Upstream of a proxy, or target and status code of a redirect. */
  target:
    | {
        kind: "proxy";
        url: string;
        skipTlsVerify: boolean;
        headers: number;
        /** Enabled upstreams with load balancing; 0 = a single upstream. */
        upstreams: number;
      }
    | { kind: "redirect"; url: string; code: number };
  tls: TlsMode;
  /** Protected by basic auth (never the credentials themselves). */
  basicAuth: boolean;
  enabled: boolean;
  /** ISO timestamp, for `<time dateTime>`. */
  updatedAt: string;
  /** Formatted on the server. */
  updatedLabel: string;
}

export type Feedback = { tone: Tone; text: string };

/** A site block of the Caddyfile: listed for completeness, edited elsewhere. */
export interface CaddyfileRowItem {
  key: string;
  /** The address as written in the Caddyfile. */
  host: string;
  /** Where it forwards to, when Caddy's running config says so. */
  target: string | null;
  /** 1-based line of the block. */
  line: number;
}

/**
 * Every route Caddy serves from the stored sources, one row each: Caddyfile
 * blocks (read-only, linked to their line) and form sites (edit, delete,
 * switch), followed by the inline row for a new route. The rows wrap on
 * narrow screens; same data and actions everywhere.
 */
export function SiteList({
  sites,
  caddyfileRows = [],
}: {
  sites: SiteListItem[];
  caddyfileRows?: CaddyfileRowItem[];
}) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-3">
      <div aria-live="polite" aria-atomic>
        {feedback ? <FeedbackAlert feedback={feedback} /> : null}
      </div>

      <section
        aria-label={t.config.routes.label}
        className="surface overflow-hidden"
      >
        <ul className="divide-y divide-border">
          {caddyfileRows.map((row) => (
            <CaddyfileRow key={row.key} row={row} />
          ))}
          {sites.map((site) => (
            <SiteRow key={site.id} site={site} onFeedback={setFeedback} />
          ))}
          <NewRouteRow />
        </ul>
      </section>
    </div>
  );
}

/** The arrow between host and target; its weight is purely decorative. */
function RouteArrow() {
  return (
    <svg
      aria-hidden
      width="48"
      height="12"
      viewBox="0 0 48 12"
      className="hidden shrink-0 text-primary md:block"
    >
      <path d="M0 6h42" stroke="currentColor" strokeWidth="2" fill="none" />
      <path
        d="M40 1l6 5-6 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  );
}

const ROW =
  "flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 data-[enabled=false]:bg-band/40";

function SourceBadge({ source }: { source: "caddyfile" | "form" }) {
  const { t } = useI18n();
  return (
    <span
      className={`min-w-[5.25rem] rounded-sm px-2 py-0.5 text-center text-[0.8125rem] ${
        source === "form"
          ? "bg-primary/10 text-primary"
          : "bg-stone text-muted-foreground"
      }`}
    >
      {source === "form"
        ? t.config.routes.sourceForm
        : t.config.routes.sourceCaddyfile}
    </span>
  );
}

function CaddyfileRow({ row }: { row: CaddyfileRowItem }) {
  const { t } = useI18n();
  return (
    <li className={ROW}>
      <span className="mono min-w-0 flex-[1_1_13rem] font-medium [overflow-wrap:anywhere]">
        {row.host}
      </span>
      <RouteArrow />
      <span className="mono min-w-0 flex-[1_1_14rem] [overflow-wrap:anywhere] text-muted-foreground">
        {row.target ?? "–"}
      </span>
      <SourceBadge source="caddyfile" />
      <span className="flex min-w-[9.5rem] justify-end">
        <Link
          href="/config/caddyfile"
          aria-label={t.config.routes.lineLabel(row.line, row.host)}
          className="text-sm underline-offset-4 hover:underline max-md:py-3"
        >
          {t.config.routes.line(row.line)}
        </Link>
      </span>
    </li>
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
    <li data-enabled={enabled} aria-busy={pending || undefined} className={ROW}>
      <div className="flex min-w-0 flex-[1_1_13rem] flex-col">
        <span
          className={`mono font-medium [overflow-wrap:anywhere] ${enabled ? "" : "text-muted-foreground"}`}
        >
          {site.hostname}
        </span>
        <p className="text-xs text-muted-foreground">
          <span className="sr-only">{l.changed} </span>
          <time dateTime={site.updatedAt}>{site.updatedLabel}</time>
        </p>
      </div>

      {site.target.kind === "redirect" ? (
        <CornerUpRight
          aria-hidden
          className="hidden size-4 shrink-0 text-primary md:block"
        />
      ) : (
        <RouteArrow />
      )}

      <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-1.5">
        <span className="mono flex min-w-0 items-center gap-1.5 text-muted-foreground">
          {site.target.kind === "redirect" ? (
            <CornerUpRight
              aria-hidden
              className="size-3.5 shrink-0 md:hidden"
            />
          ) : (
            <ArrowRight aria-hidden className="size-3.5 shrink-0 md:hidden" />
          )}
          <span className="sr-only">
            {site.target.kind === "redirect" ? l.redirectTo : l.upstream}:{" "}
          </span>
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {site.target.url}
          </span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-muted-foreground">
            <TlsIcon aria-hidden data-icon="inline-start" />
            {t.config.tls[site.tls].short}
          </Badge>
          {site.target.kind === "redirect" ? (
            <Badge variant="outline" className="text-muted-foreground">
              {l.redirect(site.target.code)}
            </Badge>
          ) : null}
          {site.target.kind === "proxy" && site.target.skipTlsVerify ? (
            <Badge variant="outline" className="text-muted-foreground">
              <ShieldOff aria-hidden data-icon="inline-start" />
              {l.skipTlsVerify}
            </Badge>
          ) : null}
          {site.target.kind === "proxy" && site.target.upstreams > 0 ? (
            <Badge variant="outline" className="text-muted-foreground">
              <Network aria-hidden data-icon="inline-start" />
              {l.loadBalanced(site.target.upstreams)}
            </Badge>
          ) : null}
          {site.target.kind === "proxy" && site.target.headers > 0 ? (
            <Badge variant="outline" className="text-muted-foreground">
              <ListPlus aria-hidden data-icon="inline-start" />
              {l.headers(site.target.headers)}
            </Badge>
          ) : null}
          {site.basicAuth ? (
            <Badge variant="outline" className="text-muted-foreground">
              <KeyRound aria-hidden data-icon="inline-start" />
              {l.basicAuth}
            </Badge>
          ) : null}
        </div>
      </div>

      <SourceBadge source="form" />

      <div className="flex min-w-[9.5rem] items-center justify-end gap-1">
        {/* The label makes the whole status area a ≥44px touch target. */}
        <label
          htmlFor={switchId}
          className="flex min-h-11 w-fit cursor-pointer items-center gap-2.5 text-sm"
        >
          <Switch
            id={switchId}
            checked={enabled}
            onCheckedChange={toggle}
            disabled={pending}
            aria-label={l.activeLabel(site.hostname)}
          />
          <span className="flex items-center gap-1.5">
            {pending ? <Spinner aria-hidden className="size-3" /> : null}
            <span className={enabled ? "" : "text-muted-foreground"}>
              {enabled ? l.active : l.inactive}
            </span>
          </span>
        </label>
        <Button asChild variant="ghost" size="icon" className="max-md:size-11">
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
export function feedbackFor(
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

export function FeedbackAlert({ feedback }: { feedback: Feedback }) {
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
