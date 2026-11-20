"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { type FormEvent, startTransition, useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { translateCode } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { TLS_MODES } from "@/modules/caddy/tls";
import { createSiteAction } from "@/server/caddy/site-actions";
import {
  emptySiteFormValues,
  type SiteFormState,
} from "@/server/caddy/site-form";

import { FieldError } from "./field-error";
import { EMPTY_DRAFT, useRouteDraft } from "./route-draft";

const INITIAL: SiteFormState = { values: emptySiteFormValues, attempt: 0 };

/**
 * The last row of the route list: creates a proxy site with the same server
 * action (validation, storing, applying) as the full form. What is typed also
 * feeds the "Vorgemerkt" panel through the draft context. Everything else a
 * site can have (redirects, load balancing, auth, …) stays in the full form.
 */
export function NewRouteRow() {
  const { t } = useI18n();
  const i = t.config.inline;
  const { draft, setDraft } = useRouteDraft();
  const [state, formAction, pending] = useActionState(
    createSiteAction,
    INITIAL,
  );

  /**
   * Submits through the action without letting React reset the form afterwards:
   * the reset sends the TLS select back to its default after a validation
   * error while the draft still holds the choice. Without JavaScript the plain
   * `action` still works.
   */
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  const errors = state.fieldErrors ?? {};
  const shown = (code: string | undefined) =>
    code === undefined ? undefined : translateCode(t, code);
  const hostnameError = shown(errors.hostname);
  const upstreamError = shown(errors.upstream);
  const tlsError = shown(errors.tls);
  const otherErrors = Object.keys(errors).filter(
    (field) => !["hostname", "upstream", "tls"].includes(field),
  );
  const formError = state.formError
    ? translateCode(t, state.formError)
    : otherErrors.length > 0
      ? i.error
      : null;

  return (
    <li className="border-l-4 border-l-primary bg-primary/5 px-5 py-4">
      <form
        action={formAction}
        onSubmit={submit}
        aria-label={i.heading}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="kind" value="proxy" />
        <input type="hidden" name="enabled" value="on" />

        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex min-w-[14rem] flex-[1_1_14rem] flex-col gap-1">
            <label htmlFor="new-route-hostname" className="text-sm font-medium">
              {i.hostname}
            </label>
            <Input
              id="new-route-hostname"
              name="hostname"
              className="mono"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={i.hostnamePlaceholder}
              value={draft.hostname}
              onChange={(event) =>
                setDraft({ ...draft, hostname: event.currentTarget.value })
              }
              aria-invalid={hostnameError ? true : undefined}
              aria-describedby={
                hostnameError ? "new-route-hostname-error" : undefined
              }
            />
            <FieldError id="new-route-hostname-error" error={hostnameError} />
          </div>

          <svg
            aria-hidden
            width="48"
            height="40"
            viewBox="0 0 48 40"
            className="mt-6 hidden shrink-0 text-primary md:block"
          >
            <path
              d="M0 20h42"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="4 4"
              fill="none"
            />
            <path
              d="M40 15l6 5-6 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            />
          </svg>

          <div className="flex min-w-[12rem] flex-[1_1_12rem] flex-col gap-1">
            <label htmlFor="new-route-upstream" className="text-sm font-medium">
              {i.target}
            </label>
            <Input
              id="new-route-upstream"
              name="upstream"
              className="mono"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={i.targetPlaceholder}
              value={draft.upstream}
              onChange={(event) =>
                setDraft({ ...draft, upstream: event.currentTarget.value })
              }
              aria-invalid={upstreamError ? true : undefined}
              aria-describedby={
                upstreamError ? "new-route-upstream-error" : undefined
              }
            />
            <FieldError id="new-route-upstream-error" error={upstreamError} />
          </div>

          <div className="flex flex-[0_1_11rem] flex-col gap-1">
            <label htmlFor="new-route-tls" className="text-sm font-medium">
              {i.tls}
            </label>
            <select
              id="new-route-tls"
              name="tls"
              value={draft.tls}
              onChange={(event) =>
                setDraft({ ...draft, tls: event.currentTarget.value })
              }
              className="field h-10 px-3 text-sm pointer-coarse:h-11"
            >
              {TLS_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {t.config.tls[mode].short}
                </option>
              ))}
            </select>
            <FieldError id="new-route-tls-error" error={tlsError} />
          </div>
        </div>

        {formError ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button asChild variant="ghost" className="max-md:h-11">
            <Link href="/config/new">{i.more}</Link>
          </Button>
          {draft.hostname || draft.upstream ? (
            <Button
              type="button"
              variant="ghost"
              className="max-md:h-11"
              disabled={pending}
              onClick={() => setDraft(EMPTY_DRAFT)}
            >
              {t.common.cancel}
            </Button>
          ) : null}
          <Button type="submit" disabled={pending} className="max-md:h-11">
            {pending ? (
              <>
                <Spinner aria-hidden /> {i.submitting}
              </>
            ) : (
              i.submit
            )}
          </Button>
        </div>
      </form>
    </li>
  );
}
