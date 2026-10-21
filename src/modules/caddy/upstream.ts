import { isIPv4, isIPv6 } from "./ip-address";
import { code } from "@/i18n/codes";

import { type ParseResult, parsed, rejected } from "./parse-result";

export interface Upstream {
  scheme: "http" | "https";
  /** Lower-case DNS name, IPv4 address or bracketed IPv6 address (`[::1]`). */
  host: string;
  port?: number;
}

const MAX_HOST_LENGTH = 253;
// Upstreams are often container or compose service names, which may contain `_`.
const HOST_LABEL = /^(?![-_])[a-z0-9_-]{1,63}(?<![-_])$/;
const HAS_LETTER = /[a-z]/;
const PORT = /^[1-9][0-9]{0,4}$/;
const IPV6_CHARS = /^[0-9a-f:.]+$/;
const VISIBLE_ASCII = /^[\x21-\x7e]+$/;

const MESSAGES = {
  required: code("upstream.required"),
  characters: code("upstream.characters"),
  scheme: code("upstream.scheme"),
  credentials: code("upstream.credentials"),
  path: code("upstream.path"),
  host: code("upstream.host"),
  port: code("upstream.port"),
};

/**
 * Validates and normalizes a reverse-proxy upstream.
 *
 * Accepted: `http(s)://<host>[:<port>]` with an optional trailing `/`, where
 * `<host>` is a DNS or container name, an IPv4 address or a bracketed IPv6
 * address. Everything else (other schemes, paths, queries, credentials,
 * whitespace, Caddyfile syntax such as `{…}` placeholders) is rejected.
 *
 * Intentionally a strict hand-written parser instead of `new URL()`: the
 * WHATWG parser silently strips tabs and newlines and rewrites hosts
 * (e.g. `0x7f.1` → `127.0.0.1`), which must not happen before a value is
 * written into a configuration file.
 */
export function parseUpstream(input: string): ParseResult<Upstream> {
  const value = input.trim();
  if (value === "") return rejected(MESSAGES.required);
  if (!VISIBLE_ASCII.test(value)) return rejected(MESSAGES.characters);

  const schemeMatch = /^([a-z][a-z0-9+.-]*):\/\//i.exec(value);
  const scheme = schemeMatch?.[1]?.toLowerCase();
  if (scheme !== "http" && scheme !== "https") return rejected(MESSAGES.scheme);

  let authority = value.slice(schemeMatch![0].length).toLowerCase();
  if (authority.endsWith("/")) authority = authority.slice(0, -1);
  if (authority.includes("@")) return rejected(MESSAGES.credentials);
  if (/[/?#]/.test(authority)) return rejected(MESSAGES.path);

  const split = splitHostPort(authority);
  if (!split) return rejected(MESSAGES.host);

  const host = parseHost(split.host);
  if (!host) return rejected(MESSAGES.host);

  if (split.port === undefined) return parsed({ scheme, host });
  if (!PORT.test(split.port) || Number(split.port) > 65_535) {
    return rejected(MESSAGES.port);
  }
  return parsed({ scheme, host, port: Number(split.port) });
}

/** Canonical string form, also used for storage: `scheme://host[:port]`. */
export function formatUpstream({ scheme, host, port }: Upstream): string {
  return `${scheme}://${host}${port === undefined ? "" : `:${port}`}`;
}

function splitHostPort(
  authority: string,
): { host: string; port?: string } | null {
  if (authority.startsWith("[")) {
    const end = authority.indexOf("]");
    if (end === -1) return null;
    const rest = authority.slice(end + 1);
    if (rest === "") return { host: authority.slice(0, end + 1) };
    if (!rest.startsWith(":")) return null;
    return { host: authority.slice(0, end + 1), port: rest.slice(1) };
  }
  const parts = authority.split(":");
  if (parts.length === 1) return { host: authority };
  if (parts.length === 2) return { host: parts[0]!, port: parts[1]! };
  return null;
}

function parseHost(host: string): string | null {
  if (host.startsWith("[")) {
    const address = host.slice(1, -1);
    // No zone IDs (`%eth0`) and nothing but plain address characters.
    return IPV6_CHARS.test(address) && isIPv6(address) ? host : null;
  }
  if (host === "" || host.length > MAX_HOST_LENGTH) return null;
  if (isIPv4(host)) return host;

  const labels = host.split(".");
  if (!labels.every((label) => HOST_LABEL.test(label))) return null;
  // All-numeric endings that are not a valid IPv4 address (e.g. `999.1.1.1`)
  // are ambiguous and rejected.
  if (!HAS_LETTER.test(labels.at(-1)!)) return null;
  return host;
}
