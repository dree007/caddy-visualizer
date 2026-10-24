import type { SiteFieldErrors } from "@/modules/caddy/contracts";
import type { SiteKind } from "@/modules/caddy/redirect";
import type { TlsMode } from "@/modules/caddy/tls";

/** Raw form values, echoed back so the form keeps the user's input after an error. */
export interface SiteFormValues {
  hostname: string;
  kind: SiteKind | string;
  upstream: string;
  upstreamSkipTlsVerify: boolean;
  redirectTarget: string;
  redirectCode: string;
  tls: TlsMode | string;
  enabled: boolean;
  basicAuth: boolean;
  basicAuthUsername: string;
  /** Only ever travels browser → server; echoed back empty. */
  basicAuthPassword: string;
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
  upstreamSkipTlsVerify: false,
  redirectTarget: "",
  redirectCode: "308",
  tls: "automatic",
  enabled: true,
  basicAuth: false,
  basicAuthUsername: "",
  basicAuthPassword: "",
};

/** Generous bound for echoing input back; the domain validation is stricter. */
const MAX_FIELD_LENGTH = 2048;

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
    upstreamSkipTlsVerify: formData.get("upstreamSkipTlsVerify") === "on",
    redirectTarget: text(formData, "redirectTarget"),
    redirectCode: text(formData, "redirectCode"),
    tls: text(formData, "tls"),
    enabled: formData.get("enabled") === "on",
    basicAuth: formData.get("basicAuth") === "on",
    basicAuthUsername: text(formData, "basicAuthUsername"),
    basicAuthPassword: text(formData, "basicAuthPassword"),
  };
}

/** Values sent back with a form error: never the password. */
export function echoedValues(values: SiteFormValues): SiteFormValues {
  return { ...values, basicAuthPassword: "" };
}
