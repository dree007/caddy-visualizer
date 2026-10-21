import { z } from "zod";

import { code } from "@/i18n/codes";

import { parseSiteHostname } from "./hostname";
import type { ParseResult } from "./parse-result";
import { TLS_MODES } from "./tls";
import { formatUpstream, parseUpstream } from "./upstream";

/** Runs a domain parser inside zod and reports its message as a field error. */
function domainString<T>(parse: (value: string) => ParseResult<T>) {
  return z
    .string({ error: code("validation.required") })
    .transform((value, ctx) => {
      const result = parse(value);
      if (result.ok) return result.value;
      ctx.addIssue({ code: "custom", message: result.message });
      return z.NEVER;
    });
}

/**
 * Input contract for creating or updating a managed site. Shared by the
 * application layer and (later) the UI; the server always validates.
 * Output values are normalized (lower-case hostname, canonical upstream).
 */
export const siteInputSchema = z.object({
  hostname: domainString(parseSiteHostname),
  upstream: domainString(parseUpstream).transform(formatUpstream),
  tls: z.enum(TLS_MODES, { error: code("validation.tls") }),
  enabled: z.boolean({ error: code("validation.enabled") }).default(true),
});

export type SiteInput = z.input<typeof siteInputSchema>;
export type ValidSiteInput = z.output<typeof siteInputSchema>;

export type SiteField = keyof ValidSiteInput;
export type SiteFieldErrors = Partial<Record<SiteField, string>>;

export type SiteValidationResult =
  | { ok: true; value: ValidSiteInput }
  | { ok: false; fieldErrors: SiteFieldErrors };

const FIELDS = new Set<string>(Object.keys(siteInputSchema.shape));

/** Validates untrusted input. Returns the first error message per field. */
export function validateSiteInput(input: unknown): SiteValidationResult {
  const result = siteInputSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };

  const fieldErrors: SiteFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && FIELDS.has(field)) {
      fieldErrors[field as SiteField] ??= issue.message;
    }
  }
  // Defensive: a non-object input has no field path.
  if (Object.keys(fieldErrors).length === 0) {
    fieldErrors.hostname = code("validation.invalid");
  }
  return { ok: false, fieldErrors };
}
