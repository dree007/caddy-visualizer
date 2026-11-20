import type { HostRow, HostUpstreamFlow } from "./queries";

/*
 * Data behind the dashboard wiring diagram: host names on the left, the
 * upstreams they are forwarded to on the right. Measured counts (access log
 * entries with an `upstream` field) are used where they exist; a host without
 * them is attributed to its configured upstreams, split evenly (`estimated`).
 */

/** A configured proxy route: host matchers and the upstreams behind them. */
export interface ProxyRoute {
  hosts: string[];
  upstreams: string[];
}

export interface SchematicHost {
  host: string;
  requests: number;
  errors: number;
  avgMs: number | null;
}

export interface SchematicUpstream {
  upstream: string;
  requests: number;
  errors: number;
  avgMs: number | null;
  /** At least part of the numbers is a split of host totals, not measured. */
  estimated: boolean;
}

export interface Schematic {
  hosts: SchematicHost[];
  upstreams: SchematicUpstream[];
  /** Hosts / upstreams beyond the limits, with their summed requests. */
  moreHosts: { count: number; requests: number; errors: number };
  moreUpstreams: { count: number; requests: number; errors: number };
}

export const HOST_LIMIT = 10;
export const UPSTREAM_LIMIT = 10;

/** Whether a Caddy host matcher (`example.com`, `*.example.com`) covers `host`. */
export function matchesHost(matcher: string, host: string): boolean {
  const m = matcher.toLowerCase();
  const h = host.toLowerCase();
  if (m === h) return true;
  return (
    m.startsWith("*.") && h.endsWith(m.slice(1)) && h.length > m.length - 1
  );
}

export function buildSchematic(
  hostRows: readonly HostRow[],
  routes: readonly ProxyRoute[],
  flows: readonly HostUpstreamFlow[],
  limits: { hosts?: number; upstreams?: number } = {},
): Schematic {
  const hostLimit = limits.hosts ?? HOST_LIMIT;
  const upstreamLimit = limits.upstreams ?? UPSTREAM_LIMIT;
  const sorted = [...hostRows]
    .filter((row) => row.requests > 0)
    .sort((a, b) => b.requests - a.requests || a.host.localeCompare(b.host));
  const shown = sorted.slice(0, hostLimit);
  const rest = sorted.slice(hostLimit);

  const flowsOf = new Map<string, HostUpstreamFlow[]>();
  for (const flow of flows) {
    const list = flowsOf.get(flow.host) ?? [];
    list.push(flow);
    flowsOf.set(flow.host, list);
  }

  interface Acc {
    requests: number;
    errors: number;
    durationSum: number;
    estimated: boolean;
  }
  const acc = new Map<string, Acc>();
  const add = (
    upstream: string,
    requests: number,
    errors: number,
    avgMs: number | null,
    estimated: boolean,
  ) => {
    const entry = acc.get(upstream) ?? {
      requests: 0,
      errors: 0,
      durationSum: 0,
      estimated: false,
    };
    entry.requests += requests;
    entry.errors += errors;
    entry.durationSum += (avgMs ?? 0) * requests;
    entry.estimated ||= estimated;
    acc.set(upstream, entry);
  };

  // Upstreams cover every host with traffic, also those folded into "more hosts".
  for (const row of sorted) {
    const measured = flowsOf.get(row.host);
    if (measured && measured.length > 0) {
      for (const flow of measured) {
        add(flow.upstream, flow.requests, flow.errors, flow.avgMs, false);
      }
      continue;
    }
    const configured = [
      ...new Set(
        routes
          .filter((route) => route.hosts.some((m) => matchesHost(m, row.host)))
          .flatMap((route) => route.upstreams),
      ),
    ];
    if (configured.length === 0) continue;
    // Even split; the remainder goes to the first upstreams so sums stay exact.
    const share = (total: number, i: number) =>
      Math.floor(total / configured.length) +
      (i < total % configured.length ? 1 : 0);
    configured.forEach((upstream, i) =>
      add(
        upstream,
        share(row.requests, i),
        share(row.errors, i),
        row.avgMs,
        configured.length > 1,
      ),
    );
  }

  const all: SchematicUpstream[] = [...acc.entries()]
    .map(([upstream, e]) => ({
      upstream,
      requests: e.requests,
      errors: e.errors,
      avgMs: e.requests > 0 ? e.durationSum / e.requests : null,
      estimated: e.estimated,
    }))
    .sort(
      (a, b) => b.requests - a.requests || a.upstream.localeCompare(b.upstream),
    );
  const sum = (rows: { requests: number; errors: number }[]) => ({
    count: rows.length,
    requests: rows.reduce((n, r) => n + r.requests, 0),
    errors: rows.reduce((n, r) => n + r.errors, 0),
  });
  return {
    hosts: shown.map(({ host, requests, errors, avgMs }) => ({
      host,
      requests,
      errors,
      avgMs,
    })),
    upstreams: all.slice(0, upstreamLimit),
    moreHosts: sum(rest),
    moreUpstreams: sum(all.slice(upstreamLimit)),
  };
}
