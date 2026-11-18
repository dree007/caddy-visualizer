"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/client";
import {
  BACKENDS_MAX,
  COOKIE_NAME_MAX_LENGTH,
  HEALTH_URI_MAX_LENGTH,
  LABEL_MAX_LENGTH,
  LB_POLICIES,
  type LbFieldKey,
  type LbPolicy,
  type LoadBalancingInput,
  RETRY_METHODS,
} from "@/modules/caddy/load-balancing";
import { HEADER_NAME_MAX_LENGTH } from "@/modules/caddy/upstream-headers";

import { FieldError } from "./field-error";

/** Load balancing on/off plus the form values, kept while switched off. */
export interface LbState {
  enabled: boolean;
  input: LoadBalancingInput;
}

type Row = LoadBalancingInput["backends"][number];
type TextKey = {
  [K in keyof LoadBalancingInput]: LoadBalancingInput[K] extends string
    ? K
    : never;
}[keyof LoadBalancingInput];

/**
 * The load balancing part of the site form, fully controlled by the editor
 * (which validates with the domain contract). Submitted as one hidden JSON
 * field; empty while switched off, so the single upstream applies.
 */
export function LoadBalancingFields({
  value,
  onChange,
  onBlurField,
  onRowsChanged,
  errorFor,
}: {
  value: LbState;
  onChange: (next: LbState) => void;
  /** A field lost the focus: validate it. */
  onBlurField: (key: LbFieldKey) => void;
  /** Rows were added, removed or moved: row errors no longer match. */
  onRowsChanged: () => void;
  /** Translated error of a field. */
  errorFor: (key: LbFieldKey) => string | undefined;
}) {
  const { t } = useI18n();
  const l = t.config.editor.lb;
  const { enabled, input } = value;
  // Stable React keys for the rows; rows move and are removed from the middle.
  const [keys, setKeys] = useState(() => input.backends.map((_, i) => i));
  const [nextKey, setNextKey] = useState(input.backends.length);
  const weighted = input.policy === "weighted_round_robin";

  const set = (patch: Partial<LoadBalancingInput>) =>
    onChange({ enabled, input: { ...input, ...patch } });
  const setRow = (index: number, patch: Partial<Row>) =>
    set({
      backends: input.backends.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    });
  function reorder(backends: Row[], nextKeys: number[]) {
    setKeys(nextKeys);
    set({ backends });
    onRowsChanged();
  }
  function move(index: number, by: -1 | 1) {
    const rows = [...input.backends];
    const order = [...keys];
    [rows[index], rows[index + by]] = [rows[index + by]!, rows[index]!];
    [order[index], order[index + by]] = [order[index + by]!, order[index]!];
    reorder(rows, order);
  }

  const text = (
    key: TextKey,
    props: Omit<
      TextFieldProps,
      "value" | "onValue" | "onBlur" | "error" | "id" | "field"
    >,
  ) => (
    <TextField
      id={`lb-${key}`}
      field={`lb.${key}`}
      value={input[key]}
      error={errorFor(`lb.${key}`)}
      onValue={(next) => set({ [key]: next })}
      onBlur={() => onBlurField(`lb.${key}`)}
      {...props}
    />
  );
  const anyAdvanced = input.active || input.passive || input.retries;
  const advancedError = (
    [
      "healthUri",
      "healthInterval",
      "healthTimeout",
      "healthStatus",
      "healthFails",
      "healthPasses",
      "failDuration",
      "maxFails",
      "unhealthyStatus",
      "unhealthyLatency",
      "retryCount",
      "tryDuration",
      "tryInterval",
      "retryMethods",
    ] as const
  ).some((key) => errorFor(`lb.${key}`));

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-band p-4">
      <input
        type="hidden"
        name="loadBalancing"
        value={enabled ? JSON.stringify(input) : ""}
      />
      <Toggle
        id="lb-enabled"
        field="lb.backends"
        label={l.title}
        hint={l.hint}
        checked={enabled}
        onChange={(next) => onChange({ enabled: next, input })}
      />

      {enabled ? (
        <>
          <div className="flex flex-col gap-1">
            <span id="lb-upstreams-label" className="text-sm font-medium">
              {l.upstreams}
            </span>
            <p className="text-xs text-muted-foreground">{l.upstreamsHint}</p>
          </div>
          <ol
            aria-labelledby="lb-upstreams-label"
            className="flex flex-col gap-3"
          >
            {input.backends.map((row, index) => {
              const id = `lb-backend-${keys[index]}`;
              const key = `lb.backends.${index}` as const;
              const n = index + 1;
              return (
                <li
                  key={keys[index]}
                  aria-label={l.upstream(n)}
                  className="flex flex-col gap-3 rounded-xl bg-card p-3 shadow-soft-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {l.upstream(n)}
                    </span>
                    <div className="flex items-center gap-1">
                      <label className="mr-2 flex min-h-11 cursor-pointer items-center gap-2 text-xs md:min-h-8">
                        <Switch
                          checked={row.enabled}
                          onCheckedChange={(checked) =>
                            setRow(index, { enabled: checked })
                          }
                          aria-label={`${l.upstream(n)}: ${l.enabled}`}
                        />
                        <span aria-hidden>{l.enabled}</span>
                      </label>
                      <IconButton
                        label={l.moveUp(n)}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp aria-hidden />
                      </IconButton>
                      <IconButton
                        label={l.moveDown(n)}
                        disabled={index === input.backends.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown aria-hidden />
                      </IconButton>
                      <IconButton
                        label={l.remove(n)}
                        destructive
                        onClick={() =>
                          reorder(
                            input.backends.filter((_, i) => i !== index),
                            keys.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <X aria-hidden />
                      </IconButton>
                    </div>
                  </div>
                  <div
                    className={`grid gap-3 ${weighted ? "sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_6rem]" : "sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"}`}
                  >
                    <TextField
                      id={`${id}-upstream`}
                      field={`${key}.upstream`}
                      label={l.address}
                      value={row.upstream}
                      placeholder="http://192.168.20.10:8080"
                      inputMode="url"
                      maxLength={2048}
                      mono
                      error={errorFor(`${key}.upstream`)}
                      onValue={(next) => setRow(index, { upstream: next })}
                      onBlur={() => onBlurField(`${key}.upstream`)}
                    />
                    <TextField
                      id={`${id}-label`}
                      field={`${key}.label`}
                      label={l.label}
                      value={row.label}
                      maxLength={LABEL_MAX_LENGTH}
                      error={errorFor(`${key}.label`)}
                      onValue={(next) => setRow(index, { label: next })}
                      onBlur={() => onBlurField(`${key}.label`)}
                    />
                    {weighted ? (
                      <TextField
                        id={`${id}-weight`}
                        field={`${key}.weight`}
                        label={l.weight}
                        value={row.weight}
                        inputMode="numeric"
                        maxLength={3}
                        error={errorFor(`${key}.weight`)}
                        onValue={(next) => setRow(index, { weight: next })}
                        onBlur={() => onBlurField(`${key}.weight`)}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
          <FieldError id="lb-backends-error" error={errorFor("lb.backends")} />
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="outline"
              disabled={input.backends.length >= BACKENDS_MAX}
              onClick={() => {
                reorder(
                  [
                    ...input.backends,
                    { upstream: "", label: "", weight: "1", enabled: true },
                  ],
                  [...keys, nextKey],
                );
                setNextKey(nextKey + 1);
              }}
              className="h-11 w-fit md:h-9"
            >
              <Plus aria-hidden data-icon="inline-start" />
              {l.add}
            </Button>
            {weighted ? (
              <p className="text-xs text-muted-foreground">{l.weightHint}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lb-policy">{l.policy}</Label>
            <select
              id="lb-policy"
              data-field="lb.policy"
              value={input.policy}
              aria-describedby="lb-policy-hint"
              aria-invalid={errorFor("lb.policy") ? true : undefined}
              onChange={(event) => set({ policy: event.target.value })}
              className="field h-11 max-w-full min-w-0 px-3.5 text-sm md:h-9"
            >
              {LB_POLICIES.map((policy) => (
                <option key={policy} value={policy}>
                  {l.policies[policy].title}
                </option>
              ))}
            </select>
            <FieldError id="lb-policy-error" error={errorFor("lb.policy")} />
            <p id="lb-policy-hint" className="text-xs text-muted-foreground">
              {l.policies[input.policy as LbPolicy]?.description}
            </p>
          </div>
          {input.policy === "header"
            ? text("header", {
                label: l.header,
                hint: l.headerHint,
                placeholder: "X-Tenant",
                maxLength: HEADER_NAME_MAX_LENGTH,
                mono: true,
              })
            : null}
          {input.policy === "cookie"
            ? text("cookie", {
                label: l.cookie,
                hint: l.cookieHint,
                maxLength: COOKIE_NAME_MAX_LENGTH,
                mono: true,
              })
            : null}

          <details
            open={anyAdvanced || advancedError || undefined}
            className="group flex flex-col gap-4 rounded-xl bg-card p-3 shadow-soft-sm"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium md:min-h-8 [&::-webkit-details-marker]:hidden">
              <ChevronRight
                aria-hidden
                className="size-4 transition-transform group-open:rotate-90"
              />
              {l.advanced}
              <span className="font-normal text-muted-foreground">
                {l.advancedHint}
              </span>
            </summary>
            <div className="mt-3 flex flex-col gap-5">
              <Toggle
                id="lb-active"
                label={l.active}
                hint={l.activeHint}
                checked={input.active}
                onChange={(next) => set({ active: next })}
              />
              {input.active ? (
                <Grid>
                  {text("healthUri", {
                    label: l.healthUri,
                    placeholder: "/health",
                    maxLength: HEALTH_URI_MAX_LENGTH,
                    mono: true,
                  })}
                  {text("healthStatus", {
                    label: l.healthStatus,
                    placeholder: "2xx",
                    maxLength: 3,
                    mono: true,
                  })}
                  {text("healthInterval", {
                    label: l.healthInterval,
                    placeholder: "30s",
                    maxLength: 10,
                    mono: true,
                  })}
                  {text("healthTimeout", {
                    label: l.healthTimeout,
                    placeholder: "5s",
                    maxLength: 10,
                    mono: true,
                  })}
                  {text("healthFails", {
                    label: l.healthFails,
                    hint: l.failsPassesHint,
                    inputMode: "numeric",
                    maxLength: 3,
                  })}
                  {text("healthPasses", {
                    label: l.healthPasses,
                    hint: l.failsPassesHint,
                    inputMode: "numeric",
                    maxLength: 3,
                  })}
                </Grid>
              ) : null}

              <Toggle
                id="lb-passive"
                label={l.passive}
                hint={l.passiveHint}
                checked={input.passive}
                onChange={(next) => set({ passive: next })}
              />
              {input.passive ? (
                <Grid>
                  {text("failDuration", {
                    label: l.failDuration,
                    placeholder: "30s",
                    maxLength: 10,
                    mono: true,
                  })}
                  {text("maxFails", {
                    label: l.maxFails,
                    inputMode: "numeric",
                    maxLength: 3,
                  })}
                  {text("unhealthyStatus", {
                    label: l.unhealthyStatus,
                    hint: l.unhealthyStatusHint,
                    placeholder: "5xx",
                    maxLength: 60,
                    mono: true,
                  })}
                  {text("unhealthyLatency", {
                    label: l.unhealthyLatency,
                    hint: l.optionalHint,
                    placeholder: "5s",
                    maxLength: 10,
                    mono: true,
                  })}
                </Grid>
              ) : null}

              <Toggle
                id="lb-retries"
                label={l.retries}
                hint={l.retriesHint}
                checked={input.retries}
                onChange={(next) => set({ retries: next })}
              />
              {input.retries ? (
                <>
                  <Grid>
                    {text("retryCount", {
                      label: l.retryCount,
                      hint: l.optionalHint,
                      inputMode: "numeric",
                      maxLength: 2,
                    })}
                    {text("tryDuration", {
                      label: l.tryDuration,
                      hint: l.optionalHint,
                      placeholder: "5s",
                      maxLength: 10,
                      mono: true,
                    })}
                    {text("tryInterval", {
                      label: l.tryInterval,
                      hint: l.optionalHint,
                      placeholder: "250ms",
                      maxLength: 10,
                      mono: true,
                    })}
                  </Grid>
                  <fieldset
                    aria-describedby="lb-retryMethods-hint"
                    className="flex flex-col gap-2"
                  >
                    <legend className="mb-2 text-sm font-medium">
                      {l.retryMethods}
                    </legend>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {RETRY_METHODS.map((method, index) => (
                        <label
                          key={method}
                          className="flex min-h-11 cursor-pointer items-center gap-2 font-mono text-sm md:min-h-8"
                        >
                          <input
                            type="checkbox"
                            data-field={
                              index === 0 ? "lb.retryMethods" : undefined
                            }
                            checked={input.retryMethods.includes(method)}
                            onChange={(event) =>
                              set({
                                retryMethods: event.target.checked
                                  ? [...input.retryMethods, method]
                                  : input.retryMethods.filter(
                                      (m) => m !== method,
                                    ),
                              })
                            }
                            className="size-4 accent-primary"
                          />
                          {method}
                        </label>
                      ))}
                    </div>
                    <FieldError
                      id="lb-retryMethods-error"
                      error={errorFor("lb.retryMethods")}
                    />
                    <p
                      id="lb-retryMethods-hint"
                      className="flex items-start gap-1.5 text-xs text-muted-foreground"
                    >
                      <TriangleAlert
                        aria-hidden
                        className="mt-px size-3.5 shrink-0"
                      />
                      {l.retryWarning}
                    </p>
                  </fieldset>
                </>
              ) : null}
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Toggle({
  id,
  field,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  field?: LbFieldKey;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{label}</Label>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      </div>
      <Switch
        id={id}
        data-field={field}
        checked={checked}
        onCheckedChange={onChange}
        aria-describedby={`${id}-hint`}
        className="mt-0.5"
      />
    </div>
  );
}

function IconButton({
  label,
  destructive = false,
  ...props
}: {
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      className={`size-11 text-muted-foreground md:size-8 ${destructive ? "hover:text-destructive" : ""}`}
      {...props}
    />
  );
}

interface TextFieldProps {
  id: string;
  field: LbFieldKey;
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  inputMode?: "url" | "numeric";
  maxLength: number;
  mono?: boolean;
  error: string | undefined;
  onValue: (value: string) => void;
  onBlur: () => void;
}

function TextField({
  id,
  field,
  label,
  hint,
  value,
  placeholder,
  inputMode,
  maxLength,
  mono = false,
  error,
  onValue,
  onBlur,
}: TextFieldProps) {
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        data-field={field}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={described || undefined}
        onChange={(event) => onValue(event.currentTarget.value)}
        onBlur={onBlur}
        className={`h-11 md:h-9 ${mono ? "font-mono" : ""}`}
      />
      <FieldError id={`${id}-error`} error={error} />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
