import { z } from "zod";

import { code } from "@/i18n/codes";

import {
  checkBasicAuthPassword,
  isBcryptHash,
  parseBasicAuthUsername,
} from "./basic-auth";
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

const siteFields = {
  hostname: domainString(parseSiteHostname),
  upstream: domainString(parseUpstream).transform(formatUpstream),
  tls: z.enum(TLS_MODES, { error: code("validation.tls") }),
  enabled: z.boolean({ error: code("validation.enabled") }).default(true),
};

/**
 * Input contract for creating or updating a managed site. Shared by the
 * application layer and the UI; the server always validates. Output values
 * are normalized (lower-case hostname, canonical upstream). The basic auth
 * password is plain text here and only hashed on the server.
 */
export const siteInputSchema = z.object({
  ...siteFields,
  basicAuth: z.boolean({ error: code("validation.invalid") }).default(false),
  basicAuthUsername: z
    .string({ error: code("validation.invalid") })
    .default(""),
  basicAuthPassword: z
    .string({ error: code("validation.invalid") })
    .default(""),
});

export type SiteInput = z.input<typeof siteInputSchema>;
export type SiteField = keyof SiteInput;
export type SiteFieldErrors = Partial<Record<SiteField, string>>;

export interface ValidSiteInput {
  hostname: string;
  upstream: string;
  tls: (typeof TLS_MODES)[number];
  enabled: boolean;
  /** `password: null` keeps the stored hash. */
  basicAuth: { username: string; password: string | null } | null;
}

export type SiteValidationResult =
  | { ok: true; value: ValidSiteInput }
  | { ok: false; fieldErrors: SiteFieldErrors };

const FIELDS = new Set<string>(Object.keys(siteInputSchema.shape));

const basicAuthFields = siteInputSchema.pick({
  basicAuth: true,
  basicAuthUsername: true,
  basicAuthPassword: true,
});

/**
 * Validates untrusted input. Returns the first error message per field.
 * `storedPassword`: the site already has a hash, so an empty password keeps it.
 */
export function validateSiteInput(
  input: unknown,
  { storedPassword = false }: { storedPassword?: boolean } = {},
): SiteValidationResult {
  const result = siteInputSchema.safeParse(input);
  const fieldErrors: SiteFieldErrors = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && FIELDS.has(field)) {
        fieldErrors[field as SiteField] ??= issue.message;
      }
    }
  }

  // Checked even when other fields are invalid, so all errors show at once.
  let basicAuth: ValidSiteInput["basicAuth"] = null;
  const auth = basicAuthFields.safeParse(input);
  if (auth.success && auth.data.basicAuth) {
    const username = parseBasicAuthUsername(auth.data.basicAuthUsername);
    if (!username.ok) fieldErrors.basicAuthUsername ??= username.message;
    const keep = auth.data.basicAuthPassword === "" && storedPassword;
    const password = keep
      ? null
      : checkBasicAuthPassword(auth.data.basicAuthPassword);
    if (password && !password.ok) {
      fieldErrors.basicAuthPassword ??= password.message;
    }
    const tls = siteFields.tls.safeParse((input as { tls?: unknown }).tls);
    if (tls.success && tls.data === "off") {
      fieldErrors.basicAuth ??= code("basicAuth.requiresHttps");
    }
    if (username.ok && (password === null || password.ok)) {
      basicAuth = {
        username: username.value,
        password: password?.value ?? null,
      };
    }
  }

  if (result.success && Object.keys(fieldErrors).length === 0) {
    const { hostname, upstream, tls, enabled } = result.data;
    return {
      ok: true,
      value: { hostname, upstream, tls, enabled, basicAuth },
    };
  }
  // Defensive: a non-object input has no field path.
  if (Object.keys(fieldErrors).length === 0) {
    fieldErrors.hostname = code("validation.invalid");
  }
  return { ok: false, fieldErrors };
}

/**
 * A site as stored and as the generator gets it: user name and bcrypt hash
 * instead of a password. Also checks rows and revision snapshots, which may be
 * older than basic auth (no fields = no basic auth).
 */
export const siteConfigSchema = z
  .object({
    ...siteFields,
    basicAuthUsername: domainString(parseBasicAuthUsername)
      .nullable()
      .default(null),
    basicAuthHash: z.string().refine(isBcryptHash).nullable().default(null),
  })
  .refine(
    (site) =>
      (site.basicAuthUsername === null) === (site.basicAuthHash === null),
    { path: ["basicAuthHash"] },
  )
  .refine((site) => site.basicAuthHash === null || site.tls !== "off", {
    path: ["tls"],
  });

export type SiteConfigInput = z.input<typeof siteConfigSchema>;
export type SiteConfig = z.output<typeof siteConfigSchema>;

export type SiteConfigResult =
  | { ok: true; value: SiteConfig }
  /** Names of the invalid fields only: the values may be secrets. */
  | { ok: false; fields: string[] };

export function validateSiteConfig(input: unknown): SiteConfigResult {
  const result = siteConfigSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  const fields = new Set(
    result.error.issues.map((issue) => String(issue.path[0] ?? "site")),
  );
  return { ok: false, fields: [...fields] };
}
