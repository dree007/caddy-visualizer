import { code } from "@/i18n/codes";

import { isCaddyText } from "./caddyfile";
import { type ParseResult, parsed, rejected } from "./parse-result";

/*
 * Request headers Caddy sets when proxying to the upstream (`header_up`).
 * Version 1 only sets or replaces a header: no `+`/`-` prefixes, no regex
 * replacements. Values may use request placeholders from a fixed list.
 */

export interface UpstreamHeader {
  name: string;
  value: string;
}

/** Generous for real use, small enough for a form and a revision snapshot. */
export const UPSTREAM_HEADERS_MAX = 50;
export const HEADER_NAME_MAX_LENGTH = 100;
export const HEADER_VALUE_MAX_LENGTH = 1024;

/** RFC 9110 token, starting with a letter or digit (so never `+`/`-` operators). */
const HEADER_NAME = /^[A-Za-z0-9][A-Za-z0-9!#$%&'*+.^_`|~-]*$/;

/**
 * Connection-level headers: setting them breaks the proxied connection, and
 * Go's HTTP client manages them itself.
 */
const HOP_BY_HOP = new Set([
  "connection",
  "content-length",
  "keep-alive",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

/** Set by Caddy's reverse proxy anyway; a manual entry replaces Caddy's value. */
const SET_BY_CADDY = new Set([
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-forwarded-host",
]);

const SENSITIVE =
  /^(?:authorization|proxy-authorization|cookie)$|api[-_]?key|token|secret|password/i;

export function parseHeaderName(input: string): ParseResult<string> {
  const value = input.trim();
  if (value === "") return rejected(code("header.nameRequired"));
  if (value.length > HEADER_NAME_MAX_LENGTH) {
    return rejected(code("header.nameTooLong"));
  }
  if (!HEADER_NAME.test(value)) return rejected(code("header.nameInvalid"));
  if (HOP_BY_HOP.has(value.toLowerCase())) {
    return rejected(code("header.nameReserved", { name: value }));
  }
  return parsed(value);
}

export function parseHeaderValue(input: string): ParseResult<string> {
  // Leading and trailing whitespace is not part of an HTTP header value.
  const value = input.trim();
  if (value === "") return rejected(code("header.valueRequired"));
  if (value.length > HEADER_VALUE_MAX_LENGTH) {
    return rejected(code("header.valueTooLong"));
  }
  if (/[\x00-\x1f\x7f]/.test(value)) {
    return rejected(code("header.valueControl"));
  }
  if (/[^\x20-\x7e]/.test(value)) return rejected(code("header.valueAscii"));
  if (/\\(?:"|$)/.test(value)) return rejected(code("header.valueBackslash"));
  if (!isCaddyText(value)) return rejected(code("header.valuePlaceholder"));
  return parsed(value);
}

/** Header names compare case-insensitively. */
export function headerKey(name: string): string {
  return name.trim().toLowerCase();
}

export function isSetByCaddy(name: string): boolean {
  return SET_BY_CADDY.has(headerKey(name));
}

/** Likely credentials: stored and shown in revisions like any other value. */
export function isSensitiveHeader(name: string): boolean {
  return SENSITIVE.test(name.trim());
}
