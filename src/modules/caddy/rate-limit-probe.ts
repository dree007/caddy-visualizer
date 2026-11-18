import { type CaddyAdminClient, CaddyAdminError } from "./admin-api";
import type { RateLimitModuleStatus } from "./rate-limit";

/**
 * Adapted (never loaded) to find out whether the running Caddy knows
 * `rate_limit`. Same form as the generated sites: a module without the
 * directive order (older builds) fails here as well.
 */
export const RATE_LIMIT_PROBE = `http://rate-limit-probe.invalid {
\trate_limit {
\t\tzone probe {
\t\t\tkey {remote_host}
\t\t\tevents 1
\t\t\twindow 1s
\t\t}
\t}
\trespond 204
}
`;

/** Caddy's adapt error for a binary without (a compatible) rate limit module. */
export function isMissingRateLimitModule(caddyMessage: string): boolean {
  return /unrecognized directive: rate_limit\b|directive 'rate_limit' is not an ordered HTTP handler/i.test(
    caddyMessage,
  );
}

export async function probeRateLimitModule(
  client: Pick<CaddyAdminClient, "adaptCaddyfile"> | null,
): Promise<RateLimitModuleStatus> {
  if (!client) return "unknown";
  try {
    await client.adaptCaddyfile(RATE_LIMIT_PROBE);
    return "available";
  } catch (error) {
    if (!(error instanceof CaddyAdminError)) throw error;
    return error.kind === "http" &&
      isMissingRateLimitModule(error.caddyMessage ?? "")
      ? "missing"
      : "unknown";
  }
}
