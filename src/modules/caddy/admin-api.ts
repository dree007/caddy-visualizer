import { request } from "node:http";
import { isAbsolute, normalize } from "node:path";

import { z } from "zod";

import { type ParseResult, parsed, rejected } from "./parse-result";
import { parseUpstream } from "./upstream";

/*
 * Client for Caddy's admin API (verified against Caddy v2.7.6 and v2.11.7).
 *
 * Deliberately built on `node:http`, not `fetch`: Node's fetch always sends
 * `Sec-Fetch-Mode: cors`, which makes Caddy require an `Origin` header and
 * answer 403. `node:http` also speaks to the unix socket that is the
 * recommended transport with `network_mode: host` (see ARCHITECTURE.md 4.2).
 *
 * Only fixed operations are offered; there is no generic passthrough. The
 * client never decides when to apply anything; that is the apply workflow's job.
 */

export type CaddyAdminAddress =
  | { transport: "unix"; socketPath: string }
  | { transport: "tcp"; host: string; port: number };

/** Linux `sun_path` holds 108 bytes including the terminating NUL. */
const MAX_SOCKET_PATH_LENGTH = 107;
const DEFAULT_ADMIN_PORT = 2019;

/**
 * Parses `CADDY_ADMIN_URL`: `unix:///absolute/path.sock` or
 * `http://host[:port]` (plain HTTP like Caddy's local admin endpoint;
 * the port defaults to 2019). No paths, queries or credentials.
 */
export function parseCaddyAdminAddress(
  input: string,
): ParseResult<CaddyAdminAddress> {
  const value = input.trim();
  if (value.startsWith("unix://")) {
    const socketPath = value.slice("unix://".length);
    if (
      !isAbsolute(socketPath) ||
      normalize(socketPath) !== socketPath ||
      !/^[\x21-\x7e]+$/.test(socketPath) ||
      socketPath.includes("|") ||
      socketPath.length > MAX_SOCKET_PATH_LENGTH
    ) {
      return rejected(
        "Expected unix:///absolute/path.sock (normalized, at most 107 characters, no permission suffix).",
      );
    }
    return parsed({ transport: "unix", socketPath });
  }

  const upstream = parseUpstream(value);
  if (!upstream.ok || upstream.value.scheme !== "http") {
    return rejected("Expected unix:///path.sock or http://host[:port].");
  }
  const { host, port = DEFAULT_ADMIN_PORT } = upstream.value;
  return parsed({
    transport: "tcp",
    // node:http expects IPv6 addresses without brackets.
    host: host.startsWith("[") ? host.slice(1, -1) : host,
    port,
  });
}

export type CaddyAdminErrorKind =
  /** No answer within the deadline. The outcome of a mutation is unknown. */
  | "timeout"
  /** Connection failed (socket missing, refused, no permission, reset). */
  | "unreachable"
  /** Caddy answered with a non-2xx status, e.g. 400 for an invalid config. */
  | "http"
  /** The answer is not what the API documents (wrong type, too large, …). */
  | "invalid-response";

export interface CaddyAdapterWarning {
  file?: string;
  line?: number;
  directive?: string;
  message?: string;
}

/**
 * Error of an admin API call. `caddyMessage` is Caddy's own error text
 * (truncated, control characters removed). It may contain file paths and
 * config details, so it is meant for logs and the authenticated admin UI only.
 */
export class CaddyAdminError extends Error {
  override name = "CaddyAdminError";

  constructor(
    readonly kind: CaddyAdminErrorKind,
    readonly operation: string,
    detail: string,
    readonly status?: number,
    readonly caddyMessage?: string,
    readonly warnings: CaddyAdapterWarning[] = [],
  ) {
    super(`Caddy admin API ${operation}: ${detail}`);
  }
}

export interface CaddyAdminClient {
  /** `GET /config/<path>`: the running config (or a part of it) and its ETag. */
  getConfig(
    path?: readonly string[],
  ): Promise<{ config: unknown; etag: string | null }>;
  /**
   * `POST /adapt`: Caddyfile → JSON without loading. Only checks what the
   * adapter sees (syntax, unknown directives, duplicate sites, missing
   * imports); provisioning errors (e.g. missing certificate files) are only
   * detected by `load`. Imports are resolved on Caddy's file system.
   */
  adaptCaddyfile(caddyfile: string): Promise<{
    config: Record<string, unknown>;
    warnings: CaddyAdapterWarning[];
  }>;
  /**
   * `POST /load`: adapts and atomically replaces the running config. On
   * failure (HTTP 400) Caddy keeps running the previous config. Not used by
   * the application yet; the apply workflow is a separate step.
   */
  loadCaddyfile(
    caddyfile: string,
    options?: { sourceFile?: string },
  ): Promise<{ warnings: CaddyAdapterWarning[] }>;
}

export interface CaddyAdminClientOptions {
  address: CaddyAdminAddress;
  /** Deadline for the whole request including the response body. */
  timeoutMs?: number;
  maxResponseBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const MAX_CADDY_MESSAGE_LENGTH = 1000;
const UNIX_SOCKET_HOST = "127.0.0.1";
const CONFIG_PATH_SEGMENT = /^[A-Za-z0-9_@-][A-Za-z0-9_.@-]*$/;

const warningSchema = z.object({
  file: z.string().optional(),
  line: z.number().optional(),
  directive: z.string().optional(),
  message: z.string().optional(),
});
const errorBodySchema = z.object({
  error: z.string(),
  warnings: z.array(warningSchema).optional(),
});
const adaptBodySchema = z.object({
  result: z.record(z.string(), z.unknown()),
  warnings: z.array(warningSchema).optional(),
});
const loadBodySchema = z.union([
  z.object({ warnings: z.array(warningSchema).optional() }),
  // Caddy 2.7.6 sends a bare array; newer releases wrap it in an object.
  z.array(warningSchema).transform((warnings) => ({ warnings })),
]);

interface RawResponse {
  status: number;
  contentType: string;
  etag: string | null;
  body: string;
}

export function createCaddyAdminClient({
  address,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
}: CaddyAdminClientOptions): CaddyAdminClient {
  function send(
    operation: string,
    method: "GET" | "POST",
    path: string,
    body?: {
      contentType: string;
      text: string;
      headers?: Record<string, string>;
    },
  ): Promise<RawResponse> {
    return new Promise((resolve, reject) => {
      const fail = (kind: CaddyAdminErrorKind, detail: string) =>
        reject(new CaddyAdminError(kind, operation, detail));

      const payload = body ? Buffer.from(body.text, "utf8") : undefined;
      const req = request({
        ...(address.transport === "unix"
          ? { socketPath: address.socketPath }
          : { host: address.host, port: address.port }),
        method,
        path,
        agent: false,
        headers: {
          // node:http sends localhost over a socket; Caddy 2.7.6 rejects it.
          // Use its accepted loopback Host. 2.11.7 disables the Unix Host check
          // and also accepts this header. TCP keeps node's host:port.
          ...(address.transport === "unix" ? { Host: UNIX_SOCKET_HOST } : {}),
          Accept: "application/json",
          ...(payload
            ? {
                "Content-Type": body!.contentType,
                "Content-Length": String(payload.length),
                ...body!.headers,
              }
            : {}),
        },
      });

      const deadline = setTimeout(() => {
        req.destroy();
        fail("timeout", `no response within ${timeoutMs} ms`);
      }, timeoutMs);
      const done = () => clearTimeout(deadline);

      req.on("error", (error: NodeJS.ErrnoException) => {
        done();
        fail("unreachable", error.code ?? error.message);
      });
      req.on("response", (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxResponseBytes) {
            done();
            req.destroy();
            fail(
              "invalid-response",
              `response exceeds ${maxResponseBytes} bytes`,
            );
            return;
          }
          chunks.push(chunk);
        });
        res.on("error", (error: NodeJS.ErrnoException) => {
          done();
          fail("unreachable", error.code ?? error.message);
        });
        res.on("end", () => {
          done();
          resolve({
            status: res.statusCode ?? 0,
            contentType: res.headers["content-type"] ?? "",
            etag:
              typeof res.headers.etag === "string" ? res.headers.etag : null,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      });

      req.end(payload);
    });
  }

  function ensureOk(operation: string, response: RawResponse): void {
    if (response.status >= 200 && response.status < 300) return;
    const parsedError = errorBodySchema.safeParse(tryJson(response.body));
    const caddyMessage = parsedError.success
      ? sanitize(parsedError.data.error)
      : undefined;
    throw new CaddyAdminError(
      "http",
      operation,
      `HTTP ${response.status}`,
      response.status,
      caddyMessage,
      parsedError.success ? (parsedError.data.warnings ?? []) : [],
    );
  }

  function jsonBody(
    operation: string,
    response: RawResponse,
    allowPlainText = false,
  ): unknown {
    if (
      !response.contentType.startsWith("application/json") &&
      !(allowPlainText && response.contentType.startsWith("text/plain"))
    ) {
      throw new CaddyAdminError(
        "invalid-response",
        operation,
        `unexpected content type "${response.contentType.slice(0, 100)}"`,
      );
    }
    const value = tryJson(response.body);
    if (value === undefined) {
      throw new CaddyAdminError(
        "invalid-response",
        operation,
        "malformed JSON",
      );
    }
    return value;
  }

  return {
    async getConfig(path = []) {
      const operation = "GET /config/";
      const response = await send(operation, "GET", configPath(path));
      ensureOk(operation, response);
      return { config: jsonBody(operation, response), etag: response.etag };
    },

    async adaptCaddyfile(caddyfile) {
      const operation = "POST /adapt";
      const response = await send(operation, "POST", "/adapt", {
        contentType: "text/caddyfile",
        text: caddyfile,
      });
      ensureOk(operation, response);
      const result = adaptBodySchema.safeParse(jsonBody(operation, response));
      if (!result.success) {
        throw new CaddyAdminError(
          "invalid-response",
          operation,
          "unexpected response shape",
        );
      }
      return {
        config: result.data.result,
        warnings: result.data.warnings ?? [],
      };
    },

    async loadCaddyfile(caddyfile, { sourceFile } = {}) {
      const operation = "POST /load";
      const response = await send(operation, "POST", "/load", {
        contentType: "text/caddyfile",
        text: caddyfile,
        // Keeps Caddy's record of the config source (used by its SIGUSR1 reload).
        headers: sourceFile
          ? {
              "Caddy-Config-Source-File": sourceFile,
              "Caddy-Config-Source-Adapter": "caddyfile",
            }
          : undefined,
      });
      ensureOk(operation, response);
      // Success is empty or JSON warnings (2.7.6: array; 2.11.7: object).
      // Both versions may infer text/plain instead of explicitly setting JSON.
      if (response.body.trim() === "") return { warnings: [] };
      const result = loadBodySchema.safeParse(
        jsonBody(operation, response, true),
      );
      if (!result.success) {
        throw new CaddyAdminError(
          "invalid-response",
          operation,
          "unexpected response shape",
        );
      }
      return { warnings: result.data.warnings ?? [] };
    },
  };
}

/** Builds `/config/<a>/<b>` from fixed segments; rejects anything path-like. */
function configPath(segments: readonly string[]): string {
  for (const segment of segments) {
    // Segments are constants of the calling code, never user input.
    if (!CONFIG_PATH_SEGMENT.test(segment) || segment.includes("..")) {
      throw new TypeError("Invalid Caddy config path segment");
    }
  }
  return `/config/${segments.join("/")}`;
}

function tryJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function sanitize(message: string): string {
  const visible = message.replace(/[\x00-\x1f\x7f]+/g, " ").trim();
  return visible.length > MAX_CADDY_MESSAGE_LENGTH
    ? `${visible.slice(0, MAX_CADDY_MESSAGE_LENGTH)}…`
    : visible;
}
