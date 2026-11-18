import { code } from "@/i18n/codes";

import { caddyText, caddyToken, type CaddyDirective } from "./caddyfile";
import { type ParseResult, parsed, rejected } from "./parse-result";

/*
 * Rate limiting by the optional Caddy module github.com/mholt/caddy-ratelimit
 * (directive `rate_limit`, not part of the standard Caddy binary). One rule is
 * one zone of the module: a sliding window of at most `events` requests per
 * `window` and client key. State is in memory per Caddy instance; nothing is
 * shared between instances (the module's `distributed` mode is not used).
 */

/**
 * How a rule tells clients apart:
 * - `remote_ip`: the peer address of the connection; cannot be spoofed.
 * - `client_ip`: the client address Caddy derives from forwarding headers, but
 *   only from proxies listed in `trusted_proxies`; otherwise the peer address.
 * - `header` / `cookie`: a request header or cookie; chosen by the client, so
 *   it identifies clients but does not stop one that varies it.
 * - `site`: one shared limit for all clients of the site.
 */
export const RATE_LIMIT_KEYS = [
  "remote_ip",
  "client_ip",
  "header",
  "cookie",
  "site",
] as const;
export type RateLimitKey = (typeof RATE_LIMIT_KEYS)[number];

export interface RateLimitRule {
  /** Unique per site; part of the zone name. */
  name: string;
  enabled: boolean;
  /** Caddy `path` matcher (e.g. `/api/*`); `null` = every request. */
  path: string | null;
  /** Requests allowed per window and key. */
  events: number;
  windowSeconds: number;
  key: RateLimitKey;
  /** Header or cookie name for those keys, `null` otherwise. */
  keyName: string | null;
}

/** Memory of the module grows with events × clients; keeps both bounded. */
export const RATE_LIMIT_RULES_MAX = 20;
export const RATE_LIMIT_EVENTS_MAX = 100_000;
export const RATE_LIMIT_WINDOW_MAX_SECONDS = 24 * 60 * 60;
export const RATE_LIMIT_NAME_MAX_LENGTH = 32;
export const RATE_LIMIT_PATH_MAX_LENGTH = 256;
export const RATE_LIMIT_KEY_NAME_MAX_LENGTH = 100;
/** IPv6 clients usually get a whole /64; one bucket per /64 stops address hopping. */
export const RATE_LIMIT_IPV6_PREFIX = 64;

const NAME = /^[a-z0-9][a-z0-9-]*$/;
/** Absolute path with `*` wildcards; no spaces, quotes, braces or `#`. */
const PATH = /^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/;
/** Characters a `{header.*}` / `{cookie.*}` placeholder name may have. */
const KEY_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const WINDOW = /^(\d{1,6})\s*(s|m|h)$/;
const UNIT_SECONDS = { s: 1, m: 60, h: 3600 } as const;

export function parseRuleName(input: string): ParseResult<string> {
  const value = input.trim().toLowerCase();
  if (value === "") return rejected(code("rateLimit.nameRequired"));
  if (value.length > RATE_LIMIT_NAME_MAX_LENGTH || !NAME.test(value)) {
    return rejected(
      code("rateLimit.nameInvalid", { max: RATE_LIMIT_NAME_MAX_LENGTH }),
    );
  }
  return parsed(value);
}

/** Empty = no matcher (every request). */
export function parseRulePath(input: string): ParseResult<string | null> {
  const value = input.trim();
  if (value === "") return parsed(null);
  if (value.length > RATE_LIMIT_PATH_MAX_LENGTH || !PATH.test(value)) {
    return rejected(code("rateLimit.pathInvalid"));
  }
  return parsed(value);
}

export function parseRuleEvents(input: string | number): ParseResult<number> {
  const value = typeof input === "number" ? input : Number(input.trim());
  if (
    String(input).trim() === "" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > RATE_LIMIT_EVENTS_MAX
  ) {
    return rejected(
      code("rateLimit.eventsInvalid", { max: RATE_LIMIT_EVENTS_MAX }),
    );
  }
  return parsed(value);
}

/** `30s`, `1m`, `2h` → seconds; between 1 s and 24 h. */
export function parseRuleWindow(input: string): ParseResult<number> {
  const match = WINDOW.exec(input.trim().toLowerCase());
  const seconds = match
    ? Number(match[1]) * UNIT_SECONDS[match[2] as keyof typeof UNIT_SECONDS]
    : 0;
  if (seconds < 1 || seconds > RATE_LIMIT_WINDOW_MAX_SECONDS) {
    return rejected(code("rateLimit.windowInvalid"));
  }
  return parsed(seconds);
}

export function parseRuleKeyName(input: string): ParseResult<string> {
  const value = input.trim();
  if (value === "") return rejected(code("rateLimit.keyNameRequired"));
  if (value.length > RATE_LIMIT_KEY_NAME_MAX_LENGTH || !KEY_NAME.test(value)) {
    return rejected(code("rateLimit.keyNameInvalid"));
  }
  return parsed(value);
}

/** Largest unit that divides evenly: 60 → `1m`, 90 → `90s`. */
export function formatWindow(seconds: number): string {
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

/** The module's key: a placeholder per client, or a constant for `site`. */
export function keyPlaceholder(rule: RateLimitRule): string {
  switch (rule.key) {
    case "remote_ip":
      return "{remote_host}";
    case "client_ip":
      return "{client_ip}";
    case "header":
      return `{header.${rule.keyName}}`;
    case "cookie":
      return `{cookie.${rule.keyName}}`;
    case "site":
      return "all";
  }
}

/**
 * `rate_limit` with one zone per enabled rule, or nothing. Zone names carry the
 * host name: they label the module's metrics and log lines. Caddy orders the
 * directive itself (before `basic_auth`, `redir` and `reverse_proxy`).
 */
export function rateLimitDirectives(
  hostname: string,
  rules: readonly RateLimitRule[],
): CaddyDirective[] {
  const zones = rules
    .filter((rule) => rule.enabled)
    .map((rule): CaddyDirective => ({
      name: caddyToken("zone"),
      args: [caddyToken(`${hostname}/${rule.name}`)],
      block: [
        ...(rule.path === null
          ? []
          : [
              {
                name: caddyToken("match"),
                args: [],
                block: [
                  { name: caddyToken("path"), args: [caddyText(rule.path)] },
                ],
              },
            ]),
        { name: caddyToken("key"), args: [caddyText(keyPlaceholder(rule))] },
        {
          name: caddyToken("events"),
          args: [caddyToken(String(rule.events))],
        },
        {
          name: caddyToken("window"),
          args: [caddyToken(formatWindow(rule.windowSeconds))],
        },
        ...(rule.key === "remote_ip" || rule.key === "client_ip"
          ? [
              {
                name: caddyToken("ipv6_prefix"),
                args: [caddyToken(String(RATE_LIMIT_IPV6_PREFIX))],
              },
            ]
          : []),
      ],
    }));
  if (zones.length === 0) return [];
  return [{ name: caddyToken("rate_limit"), args: [], block: zones }];
}

/**
 * - `available`: Caddy adapted the probe.
 * - `missing`: Caddy does not know `rate_limit` (or only an older module).
 * - `unknown`: Caddy unreachable or not configured, or another error.
 */
export type RateLimitModuleStatus = "available" | "missing" | "unknown";
