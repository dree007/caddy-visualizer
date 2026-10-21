/*
 * Read model of the sites Caddy runs, derived from its JSON config
 * (`GET /config/`). Only a summary leaves this module: host names, listen
 * addresses and what a site does. Handler settings such as basic_auth
 * accounts are never copied.
 */

export type SiteTarget =
  | { kind: "proxy"; upstreams: string[] }
  | { kind: "files"; root: string | null }
  | { kind: "redirect"; location: string; status: number }
  | { kind: "respond"; status: number };

export interface RunningSite {
  /** Host matchers of the route; empty for a catch-all (e.g. `:8081`). */
  hosts: string[];
  /** Listen addresses of its server, e.g. `:443`. */
  listen: string[];
  https: boolean;
  targets: SiteTarget[];
  /** Has an authentication handler (e.g. basic_auth). */
  auth: boolean;
}

export function runningSites(config: unknown): RunningSite[] {
  const servers = get(config, ["apps", "http", "servers"]);
  if (!isRecord(servers)) return [];
  const sites: RunningSite[] = [];
  for (const server of Object.values(servers)) {
    const listen = strings(get(server, ["listen"]));
    const https = listen.some((address) => /:443$/.test(address));
    const routes = get(server, ["routes"]);
    if (!Array.isArray(routes)) continue;
    for (const route of routes) {
      const hosts = routeHosts(route);
      const found: Found = { targets: [], auth: false, root: null };
      walk(get(route, ["handle"]), found);
      sites.push({
        hosts,
        listen,
        https,
        targets: found.targets,
        auth: found.auth,
      });
    }
  }
  // Named sites alphabetically, catch-alls (no host) at the end.
  return sites.sort(
    (a, b) =>
      Number(a.hosts.length === 0) - Number(b.hosts.length === 0) ||
      label(a).localeCompare(label(b)),
  );
}

/** First host name, or the listen address of a catch-all. */
export function label(site: RunningSite): string {
  return site.hosts[0] ?? site.listen.join(", ");
}

interface Found {
  targets: SiteTarget[];
  auth: boolean;
  /** Last `root` set by a vars handler, for a following file_server. */
  root: string | null;
}

function walk(handlers: unknown, found: Found): void {
  if (!Array.isArray(handlers)) return;
  for (const handler of handlers) {
    switch (get(handler, ["handler"])) {
      case "subroute": {
        const routes = get(handler, ["routes"]);
        if (Array.isArray(routes)) {
          for (const route of routes) walk(get(route, ["handle"]), found);
        }
        break;
      }
      case "authentication":
        found.auth = true;
        break;
      case "vars": {
        const root = get(handler, ["root"]);
        if (typeof root === "string") found.root = root;
        break;
      }
      case "reverse_proxy": {
        const tls = get(handler, ["transport", "tls"]) !== undefined;
        const upstreams = get(handler, ["upstreams"]);
        const dials = Array.isArray(upstreams)
          ? strings(upstreams.map((upstream) => get(upstream, ["dial"])))
          : [];
        add(found, {
          kind: "proxy",
          upstreams: dials.map((dial) => (tls ? `https://${dial}` : dial)),
        });
        break;
      }
      case "file_server":
        add(found, { kind: "files", root: found.root });
        break;
      case "static_response": {
        const status = Number(get(handler, ["status_code"]) ?? 200) || 200;
        const location = strings(get(handler, ["headers", "Location"]))[0];
        add(
          found,
          location
            ? { kind: "redirect", location: readable(location), status }
            : { kind: "respond", status },
        );
        break;
      }
    }
  }
}

function add(found: Found, target: SiteTarget): void {
  const key = JSON.stringify(target);
  if (!found.targets.some((existing) => JSON.stringify(existing) === key)) {
    found.targets.push(target);
  }
}

function routeHosts(route: unknown): string[] {
  const matchers = get(route, ["match"]);
  if (!Array.isArray(matchers)) return [];
  const hosts = new Set<string>();
  for (const matcher of matchers) {
    for (const host of strings(get(matcher, ["host"]))) {
      hosts.add(host.toLowerCase());
    }
  }
  return [...hosts];
}

/** Caddyfile shorthands as Caddy expands them, shown short again. */
function readable(location: string): string {
  return location.replaceAll("{http.request.uri}", "{uri}");
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
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
