"use client";

import { ArrowLeft, CircleAlert } from "lucide-react";
import Link from "next/link";
import {
  type FormEvent,
  type ReactNode,
  useActionState,
  useState,
} from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  type SiteField,
  type SiteFieldErrors,
  validateSiteInput,
} from "@/modules/caddy/contracts";
import { TLS_MODES } from "@/modules/caddy/tls";
import {
  type SiteFormState,
  type SiteFormValues,
  siteFormValues,
} from "@/server/caddy/site-form";
import { translateCode } from "@/i18n";
import { useI18n } from "@/i18n/client";

type SiteFormAction = (
  state: SiteFormState,
  formData: FormData,
) => Promise<SiteFormState>;

/** Field errors found in the browser; `null` = checked and valid (hides a server error). */
type ClientErrors = Partial<Record<SiteField, string | null>>;

const FIELD_ORDER: SiteField[] = ["hostname", "upstream", "tls", "enabled"];

/**
 * Create/edit form. Validation in the browser uses the same domain contract as
 * the server (`validateSiteInput`) and is only a convenience: the Server Action
 * validates again and is the authority.
 */
export function SiteEditor({
  action,
  initialValues,
  siteId,
  version,
  title,
  submitLabel,
}: {
  action: SiteFormAction;
  initialValues: SiteFormValues;
  /** Set when editing an existing site. */
  siteId?: string;
  /** `updatedAt` (epoch ms) of the edited version, for conflict detection. */
  version?: number;
  title: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    values: initialValues,
    attempt: 0,
  });
  // Client errors belong to one server response; a new response resets them.
  const [client, setClient] = useState<{
    attempt: number;
    errors: ClientErrors;
  }>({ attempt: 0, errors: {} });
  const clientErrors = client.attempt === state.attempt ? client.errors : {};
  const { t } = useI18n();
  const e = t.config.editor;

  /** Error codes; translated where they are shown. */
  const errorFor = (field: SiteField): string | undefined =>
    field in clientErrors
      ? (clientErrors[field] ?? undefined)
      : state.fieldErrors?.[field];
  const shown = (error: string | undefined) =>
    error === undefined ? undefined : translateCode(t, error);

  function check(form: HTMLFormElement): SiteFieldErrors {
    const result = validateSiteInput(siteFormValues(new FormData(form)));
    return result.ok ? {} : result.fieldErrors;
  }

  function setClientError(field: SiteField, message: string | null) {
    setClient((current) => ({
      attempt: state.attempt,
      errors: {
        ...(current.attempt === state.attempt ? current.errors : {}),
        [field]: message,
      },
    }));
  }

  function revalidate(field: SiteField, form: HTMLFormElement) {
    setClientError(field, check(form)[field] ?? null);
  }

  /** On blur: only once something was entered, so tabbing through stays quiet. */
  function onBlur(field: SiteField, input: HTMLInputElement) {
    if (input.value.trim() !== "" || errorFor(field)) {
      revalidate(field, input.form!);
    }
  }

  /** While typing: only to clear (or update) an error that is already shown. */
  function onChange(field: SiteField, input: HTMLInputElement) {
    if (errorFor(field)) revalidate(field, input.form!);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const errors = check(event.currentTarget);
    if (Object.keys(errors).length === 0) return;

    event.preventDefault();
    const all: ClientErrors = {};
    for (const field of FIELD_ORDER) all[field] = errors[field] ?? null;
    setClient({ attempt: state.attempt, errors: all });
    const first = FIELD_ORDER.find((field) => errors[field]);
    event.currentTarget
      .querySelector<HTMLElement>(`[data-field="${first}"]`)
      ?.focus();
  }

  const values = state.values;
  const hostnameError = errorFor("hostname");
  const upstreamError = errorFor("upstream");
  const tlsError = errorFor("tls");
  const enabledError = errorFor("enabled");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link
          href="/config"
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:min-h-8"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t.common.backToOverview}
        </Link>
        <h2 className="heading text-2xl">{title}</h2>
      </div>

      <form
        action={formAction}
        onSubmit={onSubmit}
        noValidate
        className="surface flex flex-col gap-6 p-5 sm:p-7"
      >
        {siteId ? <input type="hidden" name="id" value={siteId} /> : null}
        {version ? (
          <input type="hidden" name="version" value={version} />
        ) : null}

        {state.formError ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>
              {translateCode(t, state.formError)}
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Re-mounted per response so the echoed values become the new defaults. */}
        <fieldset
          key={state.attempt}
          disabled={pending}
          className="flex min-w-0 flex-col gap-6"
        >
          <Field
            id="hostname"
            label="Hostname"
            hint={e.hostnameHint}
            error={shown(hostnameError)}
          >
            <Input
              id="hostname"
              name="hostname"
              data-field="hostname"
              defaultValue={values.hostname}
              placeholder="app.example.com"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              maxLength={253}
              aria-invalid={hostnameError ? true : undefined}
              aria-describedby={describedBy("hostname", hostnameError)}
              onBlur={(event) => onBlur("hostname", event.currentTarget)}
              onChange={(event) => onChange("hostname", event.currentTarget)}
              className="h-11 md:h-9"
            />
          </Field>

          <Field
            id="upstream"
            label="Upstream"
            hint={e.upstreamHint}
            error={shown(upstreamError)}
          >
            <Input
              id="upstream"
              name="upstream"
              data-field="upstream"
              defaultValue={values.upstream}
              placeholder="http://192.168.1.20:8080"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              maxLength={2048}
              aria-invalid={upstreamError ? true : undefined}
              aria-describedby={describedBy("upstream", upstreamError)}
              onBlur={(event) => onBlur("upstream", event.currentTarget)}
              onChange={(event) => onChange("upstream", event.currentTarget)}
              className="h-11 font-mono md:h-9"
            />
          </Field>

          <div className="flex flex-col gap-2">
            <span id="tls-label" className="text-sm font-medium">
              TLS
            </span>
            <RadioGroup
              name="tls"
              defaultValue={values.tls}
              aria-labelledby="tls-label"
              aria-invalid={tlsError ? true : undefined}
              aria-describedby={tlsError ? "tls-error" : undefined}
              onValueChange={() => setClientError("tls", null)}
              className="grid gap-2 sm:grid-cols-2"
            >
              {TLS_MODES.map((mode) => (
                <label
                  key={mode}
                  htmlFor={`tls-${mode}`}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl bg-band p-4 transition-[background-color,box-shadow] duration-200 hover:bg-accent has-[[data-state=checked]]:bg-card has-[[data-state=checked]]:shadow-soft-sm"
                >
                  <RadioGroupItem
                    id={`tls-${mode}`}
                    value={mode}
                    data-field={mode === TLS_MODES[0] ? "tls" : undefined}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="text-sm leading-none font-medium">
                      {t.config.tls[mode].title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t.config.tls[mode].description}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
            <FieldError id="tls-error" error={shown(tlsError)} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-band p-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="enabled">{e.enabled}</Label>
                <p id="enabled-hint" className="text-xs text-muted-foreground">
                  {e.enabledHint}
                </p>
              </div>
              <Switch
                id="enabled"
                name="enabled"
                data-field="enabled"
                defaultChecked={values.enabled}
                aria-describedby="enabled-hint"
                className="mt-0.5"
              />
            </div>
            <FieldError id="enabled-error" error={shown(enabledError)} />
          </div>
        </fieldset>

        <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
          <Button asChild variant="outline" className="h-11 md:h-9">
            <Link href="/config">{t.common.cancel}</Link>
          </Button>
          <Button type="submit" className="h-11 md:h-9" disabled={pending}>
            {pending ? (
              <>
                <Spinner aria-hidden /> {t.common.saving}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function describedBy(field: SiteField, error: string | undefined) {
  return error ? `${field}-hint ${field}-error` : `${field}-hint`;
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: SiteField;
  label: string;
  hint: string;
  error: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <FieldError id={`${id}-error`} error={error} />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

function FieldError({ id, error }: { id: string; error: string | undefined }) {
  if (!error) return null;
  return (
    <p
      id={id}
      className="flex items-start gap-1.5 text-sm text-destructive"
      role="alert"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      {error}
    </p>
  );
}
