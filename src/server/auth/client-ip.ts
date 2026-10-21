/**
 * Client IP for rate limiting only (never persisted). Behind Caddy the last
 * `X-Forwarded-For` entry is the real client. Without a proxy Next.js only
 * fills it in when the client sent none, so it can be forged; the per-account
 * limit in `loginAction` covers that case.
 */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const last = forwarded?.split(",").at(-1)?.trim();
  return last || headers.get("x-real-ip")?.trim() || "unknown";
}
