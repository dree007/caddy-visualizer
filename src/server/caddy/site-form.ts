import type { SiteFieldErrors } from "@/modules/caddy/contracts";
import {
  type LoadBalancingInput,
  parseLoadBalancingInput,
} from "@/modules/caddy/load-balancing";
import type { SiteKind } from "@/modules/caddy/redirect";
import type { TlsMode } from "@/modules/caddy/tls";

/** Raw form values, echoed back so the form keeps the user's input after an error. */
export interface SiteFormValues {
  hostname: string;
  kind: SiteKind | string;
  upstream: string;
  /** Null = load balancing off (the single `upstream` applies). */
  loadBalancing: LoadBalancingInput | null;
  upstreamSkipTlsVerify: boolean;
  /** In form order, empty rows included (the contract skips them). */
  upstreamHeaders: { name: string; value: string }[];
  redirectTarget: string;
  redirectCode: string;
  tls: TlsMode | string;
  enabled: boolean;
  basicAuth: boolean;
  basicAuthUsername: string;
  /** Only ever travels browser → server; echoed back empty. */
  basicAuthPassword: string;
  /** In form order; the window as entered (`30s`, `1m`, `2h`). */
  rateLimitRules: RateLimitRuleValues[];
}

export interface RateLimitRuleValues {
  name: string;
  enabled: boolean;
  path: string;
  events: string;
  window: string;
  key: string;
  keyName: string;
}

export interface SiteFormState {
  values: SiteFormValues;
  fieldErrors?: SiteFieldErrors;
  /** Error that does not belong to a single field. */
  formError?: string;
  /** Incremented per submission; lets the form re-mount with the echoed values. */
  attempt: number;
}

/** Outcome of applying a change to Caddy, as far as the UI may know it. */
export interface ApplyOutcome {
  state:
    "applied" | "failed" | "pending" | "recovery-required" | "not-configured";
  /** UI-safe message (never raw Caddy output). */
  message?: string;
  revisionNumber?: number;
}

export type SiteActionResult =
  { ok: true; apply: ApplyOutcome } | { ok: false; message: string };

export const emptySiteFormValues: SiteFormValues = {
  hostname: "",
  kind: "proxy",
  upstream: "",
  loadBalancing: null,
  upstreamSkipTlsVerify: false,
  upstreamHeaders: [],
  redirectTarget: "",
  redirectCode: "308",
  tls: "automatic",
  enabled: true,
  basicAuth: false,
  basicAuthUsername: "",
  basicAuthPassword: "",
  rateLimitRules: [],
};

/** Generous bounds for echoing input back; the domain validation is stricter. */
const MAX_FIELD_LENGTH = 2048;
/** Bound for repeated form rows (upstream headers, rate limit rules). */
const MAX_ROWS = 200;
/** The load balancing section travels as one JSON field. */
const MAX_LOAD_BALANCING_LENGTH = 64 * 1024;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.slice(0, MAX_FIELD_LENGTH) : "";
}

/**
 * Maps a submitted site form to the plain input object of the domain contract.
 * Only extracts values; validation happens in `validateSiteInput` (via the
 * repository), never here. A checkbox/switch is only submitted when checked.
 */
export function siteFormValues(formData: FormData): SiteFormValues {
  return {
    hostname: text(formData, "hostname"),
    kind: text(formData, "kind") || "proxy",
    upstream: text(formData, "upstream"),
    loadBalancing: loadBalancingOf(formData),
    upstreamSkipTlsVerify: formData.get("upstreamSkipTlsVerify") === "on",
    upstreamHeaders: headerRows(formData),
    redirectTarget: text(formData, "redirectTarget"),
    redirectCode: text(formData, "redirectCode"),
    tls: text(formData, "tls"),
    enabled: formData.get("enabled") === "on",
    basicAuth: formData.get("basicAuth") === "on",
    basicAuthUsername: text(formData, "basicAuthUsername"),
    basicAuthPassword: text(formData, "basicAuthPassword"),
    rateLimitRules: rateLimitRows(formData),
  };
}

/**
 * One value per row and field (`rateLimitName`, …), in DOM order. The enabled
 * state is a hidden `on`/`off` input: an unchecked checkbox would not be
 * submitted and shift the rows.
 */
function rateLimitRows(formData: FormData): RateLimitRuleValues[] {
  const column = (name: string) => strings(formData, name);
  const names = column("rateLimitName");
  const enabled = column("rateLimitEnabled");
  const paths = column("rateLimitPath");
  const events = column("rateLimitEvents");
  const windows = column("rateLimitWindow");
  const keys = column("rateLimitKey");
  const keyNames = column("rateLimitKeyName");
  return names.map((name, index) => ({
    name,
    enabled: enabled[index] === "on",
    path: paths[index] ?? "",
    events: events[index] ?? "",
    window: windows[index] ?? "",
    key: keys[index] ?? "",
    keyName: keyNames[index] ?? "",
  }));
}

/** `upstreamHeaderName` / `upstreamHeaderValue` pairs, one per row. */
function headerRows(formData: FormData): SiteFormValues["upstreamHeaders"] {
  const names = strings(formData, "upstreamHeaderName");
  const values = strings(formData, "upstreamHeaderValue");
  return names.map((name, index) => ({ name, value: values[index] ?? "" }));
}

/** Empty = off; anything malformed becomes the empty form (and fails validation). */
function loadBalancingOf(formData: FormData): LoadBalancingInput | null {
  const value = formData.get("loadBalancing");
  if (typeof value !== "string" || value === "") return null;
  if (value.length > MAX_LOAD_BALANCING_LENGTH)
    return parseLoadBalancingInput(null);
  try {
    return parseLoadBalancingInput(JSON.parse(value));
  } catch {
    return parseLoadBalancingInput(null);
  }
}

/** All values of a repeated field, bounded in count and length. */
function strings(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .slice(0, MAX_ROWS)
    .map((value) =>
      typeof value === "string" ? value.slice(0, MAX_FIELD_LENGTH) : "",
    );
}

/** Values sent back with a form error: never the password. */
export function echoedValues(values: SiteFormValues): SiteFormValues {
  return { ...values, basicAuthPassword: "" };
}
