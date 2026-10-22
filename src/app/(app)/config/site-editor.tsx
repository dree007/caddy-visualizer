"use client";

import {
  ArrowLeft,
  CircleAlert,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
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
  BASIC_AUTH_PASSWORD_MIN_LENGTH,
  BASIC_AUTH_USERNAME_MAX_LENGTH,
  generateBasicAuthPassword,
} from "@/modules/caddy/basic-auth";
import {
  type SiteField,
  type SiteFieldErrors,
  validateSiteInput,
} from "@/modules/caddy/contracts";
import {
  REDIRECT_CODES,
  REDIRECT_TARGET_MAX_LENGTH,
  SITE_KINDS,
} from "@/modules/caddy/redirect";
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

const FIELD_ORDER: SiteField[] = [
  "hostname",
  "kind",
  "upstream",
  "redirectTarget",
  "redirectCode",
  "tls",
  "enabled",
  "basicAuth",
  "basicAuthUsername",
  "basicAuthPassword",
];

/**
 * Create/edit form. Validation in the browser uses the same domain contract as
 * the server (`validateSiteInput`) and is only a convenience: the Server Action
 * validates again and is the authority.
 */
export function SiteEditor({
  action,
  initialValues,
  storedPassword = false,
  siteId,
  version,
  title,
  submitLabel,
}: {
  action: SiteFormAction;
  initialValues: SiteFormValues;
  /** The site has a basic auth hash: an empty password keeps it. */
  storedPassword?: boolean;
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
  // Choices made since the last response; -1 = none yet (use the form values).
  const [tlsChoice, setTlsChoice] = useState({ attempt: -1, tls: "" });
  const tls =
    tlsChoice.attempt === state.attempt ? tlsChoice.tls : state.values.tls;
  const [kindChoice, setKindChoice] = useState({ attempt: -1, kind: "" });
  const kind =
    kindChoice.attempt === state.attempt ? kindChoice.kind : state.values.kind;
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
    const result = validateSiteInput(siteFormValues(new FormData(form)), {
      storedPassword,
    });
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
    if (!input.form) return;
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

          <ChoiceGroup
            name="kind"
            label={e.kind}
            defaultValue={values.kind}
            options={SITE_KINDS.map((option) => ({
              value: option,
              ...e.kinds[option],
            }))}
            error={shown(errorFor("kind"))}
            onValueChange={(value) => {
              setKindChoice({ attempt: state.attempt, kind: value });
              setClientError("kind", null);
            }}
          />

          {kind === "redirect" ? (
            <>
              <Field
                id="redirectTarget"
                label={e.redirectTarget}
                hint={e.redirectTargetHint}
                error={shown(errorFor("redirectTarget"))}
              >
                <Input
                  id="redirectTarget"
                  name="redirectTarget"
                  data-field="redirectTarget"
                  defaultValue={values.redirectTarget}
                  placeholder="https://www.example.com{uri}"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={REDIRECT_TARGET_MAX_LENGTH}
                  aria-invalid={errorFor("redirectTarget") ? true : undefined}
                  aria-describedby={describedBy(
                    "redirectTarget",
                    errorFor("redirectTarget"),
                  )}
                  onBlur={(event) =>
                    onBlur("redirectTarget", event.currentTarget)
                  }
                  onChange={(event) =>
                    onChange("redirectTarget", event.currentTarget)
                  }
                  className="h-11 font-mono md:h-9"
                />
              </Field>

              <ChoiceGroup
                name="redirectCode"
                label={e.redirectCode}
                defaultValue={values.redirectCode}
                options={REDIRECT_CODES.map((status) => ({
                  value: String(status),
                  ...e.redirectCodes[status],
                }))}
                error={shown(errorFor("redirectCode"))}
                onValueChange={() => setClientError("redirectCode", null)}
              />
            </>
          ) : (
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
          )}

          <ChoiceGroup
            name="tls"
            label="TLS"
            defaultValue={values.tls}
            options={TLS_MODES.map((mode) => ({
              value: mode,
              ...t.config.tls[mode],
            }))}
            error={shown(tlsError)}
            onValueChange={(value) => {
              setTlsChoice({ attempt: state.attempt, tls: value });
              setClientError("tls", null);
              if (errorFor("basicAuth")) setClientError("basicAuth", null);
            }}
          />

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

          {kind === "redirect" ? null : (
            <BasicAuthFields
              values={values}
              storedPassword={storedPassword}
              httpsOnly={tls !== "off"}
              errors={{
                basicAuth: shown(errorFor("basicAuth")),
                basicAuthUsername: shown(errorFor("basicAuthUsername")),
                basicAuthPassword: shown(errorFor("basicAuthPassword")),
              }}
              onBlur={onBlur}
              onChange={onChange}
            />
          )}
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

/**
 * Optional basic auth: user name and password, never the stored hash. With a
 * stored password the field stays empty and keeps it unless a new one is typed.
 * Only offered with HTTPS (the credentials are sent with every request).
 */
function BasicAuthFields({
  values,
  storedPassword,
  httpsOnly,
  errors,
  onBlur,
  onChange,
}: {
  values: SiteFormValues;
  storedPassword: boolean;
  httpsOnly: boolean;
  errors: Partial<Record<SiteField, string>>;
  onBlur: (field: SiteField, input: HTMLInputElement) => void;
  onChange: (field: SiteField, input: HTMLInputElement) => void;
}) {
  const { t } = useI18n();
  const e = t.config.editor;
  const [enabled, setEnabled] = useState(values.basicAuth);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [generated, setGenerated] = useState(false);
  const keeps = storedPassword && values.basicAuth;
  const usernameError = errors.basicAuthUsername;
  const passwordError = errors.basicAuthPassword;

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-band p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="basicAuth">{e.basicAuth}</Label>
          <p id="basicAuth-hint" className="text-xs text-muted-foreground">
            {e.basicAuthHint}
          </p>
        </div>
        <Switch
          id="basicAuth"
          name="basicAuth"
          data-field="basicAuth"
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={!httpsOnly && !enabled}
          aria-invalid={errors.basicAuth ? true : undefined}
          aria-describedby={
            errors.basicAuth
              ? "basicAuth-hint basicAuth-error"
              : "basicAuth-hint"
          }
          className="mt-0.5"
        />
      </div>
      <FieldError id="basicAuth-error" error={errors.basicAuth} />

      {enabled ? (
        <>
          {keeps ? (
            <p className="flex items-start gap-1.5 text-sm">
              <ShieldCheck
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              />
              {e.basicAuthActive}
            </p>
          ) : null}
          <Field
            id="basicAuthUsername"
            label={e.username}
            hint={e.usernameHint}
            error={usernameError}
          >
            <Input
              id="basicAuthUsername"
              name="basicAuthUsername"
              data-field="basicAuthUsername"
              defaultValue={values.basicAuthUsername}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              maxLength={BASIC_AUTH_USERNAME_MAX_LENGTH}
              aria-invalid={usernameError ? true : undefined}
              aria-describedby={describedBy("basicAuthUsername", usernameError)}
              onBlur={(event) =>
                onBlur("basicAuthUsername", event.currentTarget)
              }
              onChange={(event) =>
                onChange("basicAuthUsername", event.currentTarget)
              }
              className="h-11 md:h-9"
            />
          </Field>
          <Field
            id="basicAuthPassword"
            label={keeps ? e.newPassword : e.password}
            hint={
              keeps
                ? e.keepPasswordHint(BASIC_AUTH_PASSWORD_MIN_LENGTH)
                : e.passwordHint(BASIC_AUTH_PASSWORD_MIN_LENGTH)
            }
            error={passwordError}
          >
            <div className="flex gap-2">
              <Input
                id="basicAuthPassword"
                name="basicAuthPassword"
                data-field="basicAuthPassword"
                type={visible ? "text" : "password"}
                value={password}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="new-password"
                spellCheck={false}
                maxLength={256}
                aria-invalid={passwordError ? true : undefined}
                aria-describedby={describedBy(
                  "basicAuthPassword",
                  passwordError,
                )}
                onBlur={(event) =>
                  onBlur("basicAuthPassword", event.currentTarget)
                }
                onChange={(event) => {
                  setPassword(event.currentTarget.value);
                  setGenerated(false);
                  onChange("basicAuthPassword", event.currentTarget);
                }}
                className="h-11 min-w-0 flex-1 font-mono md:h-9"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={visible ? e.hidePassword : e.showPassword}
                title={visible ? e.hidePassword : e.showPassword}
                aria-pressed={visible}
                aria-controls="basicAuthPassword"
                onClick={() => setVisible((shown) => !shown)}
                className="max-md:size-11"
              >
                {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPassword(generateBasicAuthPassword());
                  setVisible(true);
                  setGenerated(true);
                }}
                className="h-11 md:h-9"
              >
                <KeyRound aria-hidden data-icon="inline-start" />
                {e.generatePassword}
              </Button>
            </div>
          </Field>
          {generated ? (
            <p role="status" className="text-sm text-muted-foreground">
              {e.generatedNotice}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Radio cards (TLS mode, kind, redirect code); the first one takes the focus on errors. */
function ChoiceGroup({
  name,
  label,
  defaultValue,
  options,
  error,
  onValueChange,
}: {
  name: SiteField;
  label: string;
  defaultValue: string;
  options: { value: string; title: string; description: string }[];
  error: string | undefined;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span id={`${name}-label`} className="text-sm font-medium">
        {label}
      </span>
      <RadioGroup
        name={name}
        defaultValue={defaultValue}
        aria-labelledby={`${name}-label`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        onValueChange={onValueChange}
        className="grid gap-2 sm:grid-cols-2"
      >
        {options.map((option, index) => (
          <label
            key={option.value}
            htmlFor={`${name}-${option.value}`}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl bg-band p-4 transition-[background-color,box-shadow] duration-200 hover:bg-accent has-[[data-state=checked]]:bg-card has-[[data-state=checked]]:shadow-soft-sm"
          >
            <RadioGroupItem
              id={`${name}-${option.value}`}
              value={option.value}
              data-field={index === 0 ? name : undefined}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-1">
              <span className="text-sm leading-none font-medium">
                {option.title}
              </span>
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </RadioGroup>
      <FieldError id={`${name}-error`} error={error} />
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
