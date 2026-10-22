import { code } from "@/i18n/codes";

import { isUrlToken } from "./caddyfile";
import { type ParseResult, parsed, rejected } from "./parse-result";

/*
 * Redirect sites: Caddy's `redir <to> <code>`. No dependencies: also imported
 * by the Drizzle schema and the editor in the browser.
 */

export const SITE_KINDS = ["proxy", "redirect"] as const;
export type SiteKind = (typeof SITE_KINDS)[number];

/** 301/308 permanent, 302/307 temporary; 307/308 keep the request method. */
export const REDIRECT_CODES = [301, 302, 307, 308] as const;
export type RedirectCode = (typeof REDIRECT_CODES)[number];

export const REDIRECT_TARGET_MAX_LENGTH = 2048;

export function parseRedirectTarget(input: string): ParseResult<string> {
  const value = input.trim();
  if (value === "") return rejected(code("redirect.targetRequired"));
  if (value.length > REDIRECT_TARGET_MAX_LENGTH) {
    return rejected(
      code("redirect.targetTooLong", { max: REDIRECT_TARGET_MAX_LENGTH }),
    );
  }
  if (!/^https?:\/\//i.test(value)) {
    return rejected(code("redirect.targetScheme"));
  }
  const scheme = value.slice(0, value.indexOf(":")).toLowerCase();
  const normalized = scheme + value.slice(scheme.length);
  if (!isUrlToken(normalized)) {
    return rejected(code("redirect.targetChars"));
  }
  try {
    const url = new URL(normalized.replace(/\{[a-z]+\}/g, "x"));
    if (url.hostname === "") throw new Error("no host");
  } catch {
    return rejected(code("redirect.targetInvalid"));
  }
  return parsed(normalized);
}

export function parseRedirectCode(input: unknown): ParseResult<RedirectCode> {
  const value = typeof input === "string" ? Number(input) : input;
  return REDIRECT_CODES.includes(value as RedirectCode)
    ? parsed(value as RedirectCode)
    : rejected(code("redirect.code"));
}
