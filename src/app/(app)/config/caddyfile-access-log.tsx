"use client";

import { CircleCheck, ScrollText } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { translateCode } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { canAdd, type CaddyfileSite } from "@/modules/caddy/caddyfile-sites";
import { enableAccessLogAction } from "@/server/caddy/access-log-actions";

import { type Feedback, FeedbackAlert, feedbackFor } from "./site-list";

/**
 * The site blocks of the main Caddyfile with their access log state. Selected
 * blocks (or all) get `import access_log` through the normal Caddyfile apply.
 */
export function CaddyfileAccessLog({
  sites,
  baseSha256,
  snippetDefined,
}: {
  sites: CaddyfileSite[];
  /** SHA-256 of the file the list was read from (conflict check). */
  baseSha256: string;
  snippetDefined: boolean;
}) {
  const { t } = useI18n();
  const a = t.config.accessLog;
  const [selected, setSelected] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();
  const open = sites.filter(canAdd);
  const chosen = selected.filter((index) =>
    open.some((site) => site.index === index),
  );

  function enable(selection: number[] | "all") {
    startTransition(async () => {
      const result = await enableAccessLogAction(selection, baseSha256);
      const shown = result.ok
        ? feedbackFor(t, result, a.saved)
        : { tone: "error" as const, text: translateCode(t, result.message) };
      setFeedback(shown);
      if (result.ok) setSelected([]);
    });
  }

  return (
    <section
      id="access-log"
      aria-labelledby="access-log-heading"
      className="surface flex flex-col gap-4 p-5 md:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-stone text-foreground shadow-pressed">
            <ScrollText aria-hidden className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 id="access-log-heading" className="heading">
              {a.heading}
            </h2>
            <p className="text-sm text-muted-foreground">{a.text}</p>
          </div>
        </div>
        {snippetDefined && open.length > 0 ? (
          <Button
            type="button"
            onClick={() => enable("all")}
            disabled={pending}
            className="max-md:h-11"
          >
            {pending ? <Spinner aria-hidden /> : null}
            {a.enableAll(open.length)}
          </Button>
        ) : null}
      </div>

      <div aria-live="polite" aria-atomic>
        {feedback ? <FeedbackAlert feedback={feedback} /> : null}
      </div>

      {!snippetDefined ? (
        <Alert>
          <AlertDescription>{a.snippetMissing}</AlertDescription>
        </Alert>
      ) : open.length === 0 ? (
        <p className="flex items-center gap-1.5 text-sm">
          <CircleCheck
            aria-hidden
            className="size-4 text-emerald-600 dark:text-emerald-400"
          />
          {a.allActive}
        </p>
      ) : null}

      <ul className="flex flex-col divide-y rounded-2xl bg-band">
        {sites.map((site) => {
          const label = site.addresses.join(", ");
          const selectable = snippetDefined && canAdd(site);
          return (
            <li key={site.index}>
              <label
                className={`flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm ${selectable ? "cursor-pointer" : ""}`}
              >
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-foreground"
                  checked={site.accessLog || chosen.includes(site.index)}
                  disabled={!selectable || pending}
                  aria-label={a.select(label)}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setSelected((current) =>
                      checked
                        ? [...current, site.index]
                        : current.filter((index) => index !== site.index),
                    );
                  }}
                />
                <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">
                  {label}
                </span>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {a.line(site.line)}
                </span>
                {site.accessLog ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    {a.active}
                  </Badge>
                ) : !site.editable ? (
                  <span className="text-xs text-muted-foreground">
                    {a.oneLine}
                  </span>
                ) : snippetDefined && !site.snippetAbove ? (
                  <span className="text-xs text-muted-foreground">
                    {a.snippetBelow}
                  </span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>

      {snippetDefined && open.length > 0 ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => enable(chosen)}
            disabled={pending || chosen.length === 0}
            className="max-md:h-11"
          >
            {a.enableSelected(chosen.length)}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
