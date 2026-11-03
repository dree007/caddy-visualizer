import { X509Certificate } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import tls from "node:tls";

import { code } from "@/i18n/codes";

import {
  type AddressClass,
  classifyAddress,
  isTrustedPrivateHost,
} from "./address-policy";

/*
 * Read-only TLS handshake against one host name: resolve it once, check the
 * addresses against the address policy, connect to exactly the address that
 * was checked (no second lookup, so DNS rebinding cannot swap the target),
 * send SNI, read the certificate and close. No HTTP request, no redirects.
 */

export type ProbeOutcome =
  | "valid"
  | "expired"
  | "invalid"
  | "unreachable"
  /** Not contacted: the address policy does not allow the resolved address. */
  | "blocked";

export interface CertificateInfo {
  subject: string | null;
  issuer: string | null;
  validFrom: Date;
  validTo: Date;
  sans: string[];
  fingerprint256: string;
}

export interface ProbeResult {
  outcome: ProbeOutcome;
  /** Message code; `null` for a valid certificate. */
  error: string | null;
  /** Address the handshake went to (or that was blocked). */
  address: string | null;
  /** Also filled for invalid certificates, for diagnosis. */
  certificate: CertificateInfo | null;
}

export type Lookup = (
  hostname: string,
) => Promise<readonly { address: string; family: number }[]>;

export interface ProbeOptions {
  /** Host names that may resolve to private addresses. */
  trustedPrivateDomains: readonly string[];
  port?: number;
  timeoutMs?: number;
  lookup?: Lookup;
  /** Tests only: the policy for the local test servers. */
  classify?: (address: string) => AddressClass;
  /** Tests only: trust anchors instead of Node's bundled CA list. */
  ca?: string | Buffer;
}

const DEFAULT_PORT = 443;
const DEFAULT_TIMEOUT_MS = 6000;
/** One IPv4 and one IPv6 attempt are enough; more only lengthens a failing run. */
const MAX_ADDRESSES = 2;
const MAX_SANS = 100;

const systemLookup: Lookup = (hostname) =>
  dnsLookup(hostname, { all: true, order: "ipv4first" });

const UNTRUSTED = new Set([
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_UNTRUSTED",
]);

/** Errors after which another address of the same host may still answer. */
const RETRYABLE = new Set([
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EADDRNOTAVAIL",
  "ETIMEDOUT",
]);

/** `hostname` must already be a validated DNS name (see `candidates.ts`). */
export async function probeCertificate(
  hostname: string,
  options: ProbeOptions,
): Promise<ProbeResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const classify = options.classify ?? classifyAddress;

  let addresses: string[];
  try {
    const records = await withTimeout(
      (options.lookup ?? systemLookup)(hostname),
      timeoutMs,
    );
    addresses = [...new Set(records.map((record) => record.address))];
  } catch (error) {
    const errno = errnoOf(error);
    return unreachable(
      null,
      errno === "ETIMEDOUT"
        ? code("cert.dnsTimeout")
        : errno === "ENOTFOUND" || errno === "ENODATA"
          ? code("cert.dnsNotFound")
          : code("cert.dnsFailed"),
    );
  }
  if (addresses.length === 0)
    return unreachable(null, code("cert.dnsNotFound"));

  // Every address must pass: a mixed answer is treated like its worst entry.
  const trusted = isTrustedPrivateHost(hostname, options.trustedPrivateDomains);
  for (const address of addresses) {
    const kind = classify(address);
    if (kind === "forbidden") {
      return blocked(address, code("cert.addressForbidden", { address }));
    }
    if (kind === "private" && !trusted) {
      return blocked(address, code("cert.addressPrivate", { address }));
    }
  }

  let result: Attempt | undefined;
  for (const address of addresses.slice(0, MAX_ADDRESSES)) {
    result = await handshake(hostname, address, options, timeoutMs);
    if (result.outcome !== "unreachable" || !result.retryable) break;
  }
  const { outcome, error, address, certificate } = result!;
  return { outcome, error, address, certificate };
}

type Attempt = ProbeResult & { retryable?: boolean };

function handshake(
  hostname: string,
  address: string,
  options: ProbeOptions,
  timeoutMs: number,
): Promise<Attempt> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: Attempt) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };

    const socket = tls.connect({
      host: address,
      port: options.port ?? DEFAULT_PORT,
      servername: hostname,
      // Validation is evaluated below so that the certificate stays readable.
      rejectUnauthorized: false,
      ca: options.ca,
    });
    const timer = setTimeout(
      () =>
        finish({
          ...unreachable(address, code("cert.timeout")),
          retryable: true,
        }),
      timeoutMs,
    );

    socket.once("secureConnect", () => {
      finish(evaluate(socket, hostname, address));
    });
    socket.once("error", (error) => {
      const errno = errnoOf(error);
      if (errno?.startsWith("ERR_SSL_") || errno === "ECONNRESET") {
        finish({
          outcome: "invalid",
          error: code("cert.handshakeFailed", { detail: errno }),
          address,
          certificate: null,
        });
        return;
      }
      finish({
        ...unreachable(
          address,
          errno === "ECONNREFUSED"
            ? code("cert.refused")
            : errno === "EHOSTUNREACH" || errno === "ENETUNREACH"
              ? code("cert.networkUnreachable")
              : code("cert.connectFailed", { detail: errno ?? "unknown" }),
        ),
        retryable: errno !== undefined && RETRYABLE.has(errno),
      });
    });
  });
}

function evaluate(
  socket: tls.TLSSocket,
  hostname: string,
  address: string,
): ProbeResult {
  // Read before the X509 object: after `getPeerX509Certificate()`, Node
  // returns this legacy object without `subjectaltname`.
  const peer = socket.getPeerCertificate();
  const x509 = socket.getPeerX509Certificate();
  if (!x509) {
    return {
      outcome: "invalid",
      error: code("cert.noCertificate"),
      address,
      certificate: null,
    };
  }
  const certificate = describe(x509);
  // Node checks the host name only after a valid chain; for diagnosis it is
  // checked here in any case, with the same function.
  const hostnameError = tls.checkServerIdentity(hostname, peer);
  const chainError = authorizationCode(socket);
  const invalid = (error: string): ProbeResult => ({
    outcome: "invalid",
    error,
    address,
    certificate,
  });

  if (chainError === "CERT_HAS_EXPIRED" || certificate.validTo <= new Date()) {
    return {
      outcome: "expired",
      error: code("cert.expired"),
      address,
      certificate,
    };
  }
  if (chainError === "CERT_NOT_YET_VALID")
    return invalid(code("cert.notYetValid"));
  if (hostnameError) return invalid(code("cert.hostname", { hostname }));
  if (chainError && UNTRUSTED.has(chainError)) {
    return invalid(code("cert.untrusted", { detail: chainError }));
  }
  if (chainError) return invalid(code("cert.rejected", { detail: chainError }));
  if (!socket.authorized)
    return invalid(code("cert.rejected", { detail: "unknown" }));
  return { outcome: "valid", error: null, address, certificate };
}

function describe(x509: X509Certificate): CertificateInfo {
  return {
    subject: field(x509.subject, "CN"),
    issuer:
      [field(x509.issuer, "O"), field(x509.issuer, "CN")]
        .filter((part) => part !== null)
        .join(" · ") || null,
    validFrom: x509.validFromDate,
    validTo: x509.validToDate,
    sans: parseSans(x509.subjectAltName),
    fingerprint256: x509.fingerprint256,
  };
}

/** `DNS:a.test, DNS:"b,c.test", IP Address:10.0.0.1` → host names and addresses. */
export function parseSans(value: string | undefined): string[] {
  if (!value) return [];
  const sans: string[] = [];
  for (const match of value.matchAll(
    /(?:^|, )(?:DNS|IP Address):("(?:[^"\\]|\\.)*"|[^,]*)/g,
  )) {
    const raw = match[1]!;
    sans.push(raw.startsWith('"') ? (JSON.parse(raw) as string) : raw);
    if (sans.length === MAX_SANS) break;
  }
  return sans;
}

function field(distinguishedName: string, key: string): string | null {
  for (const line of distinguishedName.split("\n")) {
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1);
  }
  return null;
}

function authorizationCode(socket: tls.TLSSocket): string | null {
  // Typed as Error, but Node stores the OpenSSL code as a string.
  const value = socket.authorizationError as unknown;
  if (!value) return null;
  if (typeof value === "string") return value;
  return errnoOf(value) ?? String(value);
}

function unreachable(address: string | null, error: string): ProbeResult {
  return { outcome: "unreachable", error, address, certificate: null };
}

function blocked(address: string, error: string): ProbeResult {
  return { outcome: "blocked", error, address, certificate: null };
}

function errnoOf(error: unknown): string | undefined {
  const value = (error as { code?: unknown } | null)?.code;
  return typeof value === "string" ? value : undefined;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
