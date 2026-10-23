/** Change of a metric against the previous period of the same length. */
export type Trend =
  /** Relative change, e.g. 0.3 for +30 %. */
  | { kind: "change"; ratio: number }
  /** Nothing before, something now: no meaningful percentage. */
  | { kind: "new" }
  /** No comparison possible (no data in one of the periods). */
  | { kind: "none" };

export function trendOf(
  current: number | null,
  previous: number | null,
): Trend {
  if (current === null || previous === null) return { kind: "none" };
  if (previous === 0) {
    return current === 0 ? { kind: "change", ratio: 0 } : { kind: "new" };
  }
  return { kind: "change", ratio: (current - previous) / previous };
}

/** Share of `part` in `total`; null without a total. */
export function rateOf(part: number, total: number): number | null {
  return total > 0 ? part / total : null;
}
