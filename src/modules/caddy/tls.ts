/**
 * TLS handling of a managed site:
 * - `automatic`: Caddy's automatic HTTPS (certificate, HTTP→HTTPS redirect)
 * - `off`: plain HTTP only, for local/internal sites (`http://` site address)
 *
 * No dependencies on purpose: also imported by the Drizzle schema.
 */
export const TLS_MODES = ["automatic", "off"] as const;

export type TlsMode = (typeof TLS_MODES)[number];
