/*
 * IP address syntax checks without `node:net`, so the domain parsers (and with
 * them the shared site contract) also run in the browser for form validation.
 * Same grammar as Node's `net.isIPv4` / `net.isIPv6` (verified against them in
 * the tests), except that IPv6 zone IDs (`%eth0`) are never accepted.
 */

const V4_SEGMENT = "(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])";
const V4 = `(?:${V4_SEGMENT}\\.){3}${V4_SEGMENT}`;
const V6_SEGMENT = "(?:[0-9a-fA-F]{1,4})";

const IPV4 = new RegExp(`^${V4}$`);
const IPV6 = new RegExp(
  "^(?:" +
    `(?:${V6_SEGMENT}:){7}(?:${V6_SEGMENT}|:)|` +
    `(?:${V6_SEGMENT}:){6}(?:${V4}|:${V6_SEGMENT}|:)|` +
    `(?:${V6_SEGMENT}:){5}(?::${V4}|(?::${V6_SEGMENT}){1,2}|:)|` +
    `(?:${V6_SEGMENT}:){4}(?:(?::${V6_SEGMENT}){0,1}:${V4}|(?::${V6_SEGMENT}){1,3}|:)|` +
    `(?:${V6_SEGMENT}:){3}(?:(?::${V6_SEGMENT}){0,2}:${V4}|(?::${V6_SEGMENT}){1,4}|:)|` +
    `(?:${V6_SEGMENT}:){2}(?:(?::${V6_SEGMENT}){0,3}:${V4}|(?::${V6_SEGMENT}){1,5}|:)|` +
    `(?:${V6_SEGMENT}:){1}(?:(?::${V6_SEGMENT}){0,4}:${V4}|(?::${V6_SEGMENT}){1,6}|:)|` +
    `(?::(?:(?::${V6_SEGMENT}){0,5}:${V4}|(?::${V6_SEGMENT}){1,7}|:))` +
    ")$",
);

/** Dotted-quad IPv4 without leading zeros, e.g. `192.168.1.20`. */
export function isIPv4(value: string): boolean {
  return IPV4.test(value);
}

/** IPv6 address without brackets and without zone ID, e.g. `fd00::20`. */
export function isIPv6(value: string): boolean {
  return IPV6.test(value);
}
