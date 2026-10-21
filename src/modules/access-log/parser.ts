/*
 * One line of Caddy's JSON access log → the stored fields (ARCHITECTURE.md
 * 6.4). Everything else in the line (client IP, query string, headers, user
 * agent, TLS details) is never read into the result.
 */

export interface AccessLogEntry {
  /** Epoch milliseconds (UTC). */
  ts: number;
  host: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  bytes: number;
}

const MAX_PATH_LENGTH = 2048;
const MAX_HOST_LENGTH = 253;

/** `null` for anything that is not a well-formed access log entry. */
export function parseAccessLogLine(line: string): AccessLogEntry | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const logger = value.logger;
  if (typeof logger !== "string" || !logger.startsWith("http.log.access")) {
    return null;
  }
  const request = value.request;
  if (!isRecord(request)) return null;

  const ts = timestamp(value.ts);
  const host = normalizeHost(request.host);
  const method = typeof request.method === "string" ? request.method : null;
  const status = value.status;
  if (
    ts === null ||
    host === null ||
    !method ||
    !/^[A-Z]{1,16}$/.test(method) ||
    typeof status !== "number" ||
    !Number.isInteger(status) ||
    status < 100 ||
    status > 999
  ) {
    return null;
  }
  const duration = value.duration;
  const size = value.size;
  return {
    ts,
    host,
    method,
    path: pathOf(request.uri),
    status,
    durationMs:
      typeof duration === "number" && duration >= 0 ? duration * 1000 : 0,
    bytes: typeof size === "number" && size >= 0 ? Math.round(size) : 0,
  };
}

/** Lower case, without port and IPv6 brackets. */
export function normalizeHost(value: unknown): string | null {
  if (typeof value !== "string" || value === "") return null;
  let host = value.trim().toLowerCase();
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    host = end > 0 ? host.slice(1, end) : host;
  } else if (host.split(":").length === 2) {
    host = host.slice(0, host.indexOf(":"));
  }
  if (host === "" || host.length > MAX_HOST_LENGTH) return null;
  return /^[a-z0-9.:_-]+$/.test(host) ? host : null;
}

/** Caddy writes seconds as a float; with a custom time_format a string. */
function timestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value * 1000);
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function pathOf(uri: unknown): string {
  if (typeof uri !== "string" || uri === "") return "/";
  const cut = uri.search(/[?#]/);
  const path = cut >= 0 ? uri.slice(0, cut) : uri;
  return (path || "/").slice(0, MAX_PATH_LENGTH);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
