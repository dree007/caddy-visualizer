/**
 * Host names that site routes of a Caddy JSON config match on
 * (`apps.http.servers.*.routes[*].match[*].host`), lower-cased. Routes without
 * a host matcher (catch-alls such as `:8081`) contribute nothing.
 */
export function routeHostnames(config: unknown): Set<string> {
  const hosts = new Set<string>();
  const servers = get(config, ["apps", "http", "servers"]);
  if (!isRecord(servers)) return hosts;
  for (const server of Object.values(servers)) {
    const routes = get(server, ["routes"]);
    if (!Array.isArray(routes)) continue;
    for (const route of routes) {
      const matchers = get(route, ["match"]);
      if (!Array.isArray(matchers)) continue;
      for (const matcher of matchers) {
        const host = get(matcher, ["host"]);
        if (!Array.isArray(host)) continue;
        for (const name of host) {
          if (typeof name === "string") hosts.add(name.toLowerCase());
        }
      }
    }
  }
  return hosts;
}

/**
 * Whether `hostname` is served by one of `patterns`: equal, or matched by a
 * single-label wildcard (`*.example.com`), like Caddy's host matcher.
 */
export function hostnameCovered(
  hostname: string,
  patterns: ReadonlySet<string>,
): string | null {
  if (patterns.has(hostname)) return hostname;
  const dot = hostname.indexOf(".");
  if (dot > 0) {
    const wildcard = `*${hostname.slice(dot)}`;
    if (patterns.has(wildcard)) return wildcard;
  }
  return null;
}

function get(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
