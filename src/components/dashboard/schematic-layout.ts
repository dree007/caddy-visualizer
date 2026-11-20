import type { Schematic } from "@/modules/access-log/schematic";

/** Geometry of the wiring diagram (SVG user units, viewBox width 1200). */
export const VIEW_WIDTH = 1200;
export const LEFT_X = 300;
export const BOX_X = 540;
export const BOX_WIDTH = 120;
export const RIGHT_X = 900;
export const MIN_STROKE = 2;
export const MAX_STROKE = 18;
const TOP = 60;

export interface LayoutRow {
  key: string;
  /** Aggregated "more" row instead of a single host/upstream. */
  more: boolean;
  /** Text baseline center of the row. */
  y: number;
  requests: number;
  errors: number;
  /** Stroke width of the line to/from Caddy. */
  stroke: number;
  /** Where the line meets the Caddy box. */
  attachY: number;
}

export interface Layout {
  height: number;
  boxY: number;
  boxHeight: number;
  hosts: LayoutRow[];
  upstreams: LayoutRow[];
}

/** Stroke width proportional to `requests / max`, clamped to the min/max. */
export function strokeFor(requests: number, max: number): number {
  if (max <= 0 || requests <= 0) return MIN_STROKE;
  return Math.min(
    MAX_STROKE,
    Math.max(MIN_STROKE, (requests / max) * MAX_STROKE),
  );
}

export function layoutSchematic(data: Schematic): Layout {
  const hostRows = [
    ...data.hosts.map((h) => ({
      key: h.host,
      more: false,
      requests: h.requests,
      errors: h.errors,
    })),
    ...(data.moreHosts.count > 0
      ? [{ key: "…hosts", more: true, ...data.moreHosts }]
      : []),
  ];
  const upstreamRows = [
    ...data.upstreams.map((u) => ({
      key: u.upstream,
      more: false,
      requests: u.requests,
      errors: u.errors,
    })),
    ...(data.moreUpstreams.count > 0
      ? [{ key: "…upstreams", more: true, ...data.moreUpstreams }]
      : []),
  ];
  const rows = Math.max(hostRows.length, upstreamRows.length, 1);
  const gap = rows <= 5 ? 75 : 62;
  const extent = (rows - 1) * gap;
  const height = TOP + extent + 60;
  const center = TOP + extent / 2 + 5;

  const max = Math.max(
    0,
    ...hostRows.map((r) => r.requests),
    ...upstreamRows.map((r) => r.requests),
  );
  const raw = (list: typeof hostRows) =>
    list.map((r) => strokeFor(r.requests, max));
  const rawLeft = raw(hostRows);
  const rawRight = raw(upstreamRows);
  const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);
  const need = Math.max(sum(rawLeft), sum(rawRight)) + 24;
  const boxHeight = Math.min(Math.max(120, need), Math.max(120, extent + 40));
  const factor = need > boxHeight ? (boxHeight - 24) / (need - 24) : 1;

  const place = (list: typeof hostRows, widths: number[]): LayoutRow[] => {
    const scaled = widths.map((w) => Math.max(1, w * factor));
    // Spread the rows evenly around the vertical center of the diagram.
    const offset = ((rows - list.length) * gap) / 2;
    let cursor = center - sum(scaled) / 2;
    return list.map((row, i) => {
      const stroke = scaled[i]!;
      const attachY = cursor + stroke / 2;
      cursor += stroke;
      return {
        ...row,
        y: TOP + offset + i * gap,
        stroke,
        attachY,
      };
    });
  };
  return {
    // The Caddy box must fit even when one row makes the diagram very short.
    height: Math.max(height, center + boxHeight / 2 + 5),
    boxY: center - boxHeight / 2,
    boxHeight,
    hosts: place(hostRows, rawLeft),
    upstreams: place(upstreamRows, rawRight),
  };
}
