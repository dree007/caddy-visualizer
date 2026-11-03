import { BlockList, isIPv4 } from "node:net";

/*
 * Which resolved addresses a certificate check may connect to.
 *
 * - `forbidden`: loopback, link-local (cloud metadata), unspecified, multicast
 *   and reserved ranges. Never contacted: no site served by Caddy legitimately
 *   lives there from the manager's point of view.
 * - `private`: RFC 1918, CGNAT, unique local and NAT64 ranges. Only for host
 *   names the operator trusts explicitly (`CERT_CHECK_PRIVATE_DOMAINS`), so a
 *   foreign DNS record cannot point the checker at internal services.
 * - `public`: everything else.
 */

export type AddressClass = "public" | "private" | "forbidden";

const forbidden = new BlockList();
forbidden.addSubnet("0.0.0.0", 8, "ipv4");
forbidden.addSubnet("127.0.0.0", 8, "ipv4");
forbidden.addSubnet("169.254.0.0", 16, "ipv4");
forbidden.addSubnet("224.0.0.0", 4, "ipv4");
forbidden.addSubnet("240.0.0.0", 4, "ipv4");
forbidden.addAddress("::", "ipv6");
forbidden.addAddress("::1", "ipv6");
forbidden.addSubnet("fe80::", 10, "ipv6");
forbidden.addSubnet("ff00::", 8, "ipv6");

const internal = new BlockList();
internal.addSubnet("10.0.0.0", 8, "ipv4");
internal.addSubnet("172.16.0.0", 12, "ipv4");
internal.addSubnet("192.168.0.0", 16, "ipv4");
internal.addSubnet("100.64.0.0", 10, "ipv4");
internal.addSubnet("192.0.0.0", 24, "ipv4");
internal.addSubnet("198.18.0.0", 15, "ipv4");
internal.addSubnet("fc00::", 7, "ipv6");
internal.addSubnet("fec0::", 10, "ipv6");
internal.addSubnet("64:ff9b::", 96, "ipv6");
internal.addSubnet("64:ff9b:1::", 48, "ipv6");

const MAPPED_IPV4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

export function classifyAddress(address: string): AddressClass {
  // IPv4-mapped IPv6 (`::ffff:10.0.0.1`) reaches the IPv4 address.
  const mapped = MAPPED_IPV4.exec(address)?.[1];
  const value = mapped ?? address;
  const family = isIPv4(value) ? "ipv4" : "ipv6";
  if (forbidden.check(value, family)) return "forbidden";
  if (internal.check(value, family)) return "private";
  return "public";
}

/** `app.home.example` is covered by `home.example` and by itself. */
export function isTrustedPrivateHost(
  hostname: string,
  domains: readonly string[],
): boolean {
  return domains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}
