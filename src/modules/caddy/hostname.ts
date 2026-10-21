import { code } from "@/i18n/codes";
import { type ParseResult, parsed, rejected } from "./parse-result";

/** RFC 1035 limit for a full DNS name (without trailing dot). */
export const HOSTNAME_MAX_LENGTH = 253;

const DNS_LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const HAS_LETTER = /[a-z]/;

/**
 * Validates and normalizes the address of a managed site.
 *
 * Accepted: a lower-case DNS name with at least two labels, e.g.
 * `example.com` or `app.example.com`. Internationalized names must be
 * entered in punycode (`xn--…`).
 *
 * Deliberately not supported (yet):
 * - wildcards (`*.example.com`): automatic HTTPS for wildcards requires the
 *   DNS challenge, i.e. a DNS provider module and credentials in Caddy
 * - IP addresses, single-label names (`localhost`), ports, schemes and paths
 *
 * Only syntax is checked; no DNS lookup takes place.
 */
export function parseSiteHostname(input: string): ParseResult<string> {
  const value = input.trim().toLowerCase();

  if (value === "") return rejected(code("hostname.required"));
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(value)) {
    return rejected(code("hostname.scheme"));
  }
  if (/\s/.test(value)) {
    return rejected(code("hostname.whitespace"));
  }
  if (value.includes("/")) {
    return rejected(code("hostname.path"));
  }
  if (value.includes("*")) {
    return rejected(code("hostname.wildcard"));
  }
  if (value.includes(":")) {
    return rejected(code("hostname.port"));
  }
  if (value.length > HOSTNAME_MAX_LENGTH) {
    return rejected(code("hostname.tooLong"));
  }

  const labels = value.split(".");
  if (!labels.every((label) => DNS_LABEL.test(label))) {
    return rejected(code("hostname.invalid"));
  }
  if (labels.length < 2) {
    return rejected(code("hostname.incomplete"));
  }
  // Rejects IPv4 addresses and other all-numeric endings.
  if (!HAS_LETTER.test(labels.at(-1)!)) {
    return rejected(code("hostname.ip"));
  }

  return parsed(value);
}
