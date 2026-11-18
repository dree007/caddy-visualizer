import type { UpstreamMetrics } from "./queries";

export type UpstreamHealth = "healthy" | "unhealthy" | "disabled" | "unknown";

export interface DistributionRow {
  /** `host:port` as Caddy dials and logs it. */
  upstream: string;
  label: string | null;
  /** In the site's current configuration (else only seen in the log). */
  configured: boolean;
  /** Configured weight with `weighted_round_robin`; never measured data. */
  weight: number | null;
  health: UpstreamHealth;
  /** Measured; 0 for configured upstreams without logged requests. */
  requests: number;
  errors: number;
  avgMs: number | null;
  series: number[];
}

export interface ConfiguredBackend {
  dial: string | null;
  label: string;
  weight: number;
  enabled: boolean;
}

/**
 * One row per configured backend (in list order) plus upstreams that only
 * appear in the log (e.g. removed since). Counts come from `metrics` alone;
 * a configured upstream without logged requests shows 0, never an estimate.
 */
export function distributionRows(
  metrics: UpstreamMetrics,
  configured: { policy: string; backends: ConfiguredBackend[] } | null,
  health: Record<string, boolean> | null,
): DistributionRow[] {
  const measured = new Map(metrics.upstreams.map((row) => [row.upstream, row]));
  const empty = metrics.labels.map(() => 0);
  const healthOf = (dial: string): UpstreamHealth =>
    health?.[dial] === undefined
      ? "unknown"
      : health[dial]
        ? "healthy"
        : "unhealthy";
  const rows: DistributionRow[] = [];
  for (const backend of configured?.backends ?? []) {
    if (
      backend.dial === null ||
      rows.some((r) => r.upstream === backend.dial)
    ) {
      continue;
    }
    const row = measured.get(backend.dial);
    measured.delete(backend.dial);
    rows.push({
      upstream: backend.dial,
      label: backend.label || null,
      configured: true,
      weight:
        configured?.policy === "weighted_round_robin" ? backend.weight : null,
      health: backend.enabled ? healthOf(backend.dial) : "disabled",
      requests: row?.requests ?? 0,
      errors: row?.errors ?? 0,
      avgMs: row?.avgMs ?? null,
      series: row?.series ?? empty,
    });
  }
  for (const row of measured.values()) {
    rows.push({
      ...row,
      label: null,
      configured: false,
      weight: null,
      health: "unknown",
    });
  }
  return rows;
}
