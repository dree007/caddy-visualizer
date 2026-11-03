import { parseSiteHostname } from "@/modules/caddy/hostname";
import { isIPv4, isIPv6 } from "@/modules/caddy/ip-address";

/*
 * Host names to check, derived only from the sites Caddy runs. Nothing typed
 * in the browser becomes a check target.
 */

export type NotApplicableReason = "wildcard" | "ip" | "not-a-hostname" | "http";

export type Candidate =
  | { hostname: string; checkable: true }
  | { hostname: string; checkable: false; reason: NotApplicableReason };

/** At most this many host names per run; the rest stay unchecked. */
export const MAX_CHECKED_HOSTS = 100;

export function certificateCandidates(
  sites: readonly { hosts: readonly string[]; https: boolean }[],
): Candidate[] {
  const byHost = new Map<string, Candidate>();
  for (const site of sites) {
    for (const host of site.hosts) {
      const candidate = classify(host, site.https);
      // The same host on an HTTPS server wins over an HTTP-only entry.
      if (!byHost.get(candidate.hostname)?.checkable) {
        byHost.set(candidate.hostname, candidate);
      }
    }
  }
  return [...byHost.values()].sort((a, b) =>
    a.hostname.localeCompare(b.hostname),
  );
}

function classify(host: string, https: boolean): Candidate {
  const hostname = host.toLowerCase();
  // A wildcard is a pattern, not a name that can be resolved and connected to.
  if (hostname.includes("*")) {
    return { hostname, checkable: false, reason: "wildcard" };
  }
  if (isIPv4(hostname) || isIPv6(hostname.replace(/^\[|\]$/g, ""))) {
    return { hostname, checkable: false, reason: "ip" };
  }
  // Same strict rules as form sites: no single labels, placeholders or ports.
  if (!parseSiteHostname(hostname).ok) {
    return { hostname, checkable: false, reason: "not-a-hostname" };
  }
  if (!https) return { hostname, checkable: false, reason: "http" };
  return { hostname, checkable: true };
}

/** The checkable host names of a run, capped. */
export function checkTargets(candidates: readonly Candidate[]): string[] {
  return candidates
    .filter((candidate) => candidate.checkable)
    .slice(0, MAX_CHECKED_HOSTS)
    .map((candidate) => candidate.hostname);
}
