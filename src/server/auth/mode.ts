/**
 * `AUTH_DISABLED=true`: the built-in login is off because a reverse proxy
 * authenticates every request (ARCHITECTURE.md 8.7). The only place that
 * decides this. Read from `process.env` so `proxy.ts` can use it as well;
 * `getEnv()` rejects any other value than `true`/`false` at start-up.
 */
export function authDisabled(): boolean {
  return process.env.AUTH_DISABLED === "true";
}
