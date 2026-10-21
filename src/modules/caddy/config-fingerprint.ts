import { createHash } from "node:crypto";

/**
 * Fingerprint of a Caddy JSON configuration: SHA-256 of its canonical form
 * (object keys sorted recursively, no whitespace).
 *
 * Why this identifies "Caddy runs revision X": Caddy keeps the JSON it was
 * loaded with as its raw config and returns exactly that from `GET /config/`
 * (re-encoded, so only the key order changes; no defaults are filled in). The
 * expected value is computed from `POST /adapt` of the same Caddyfile text that
 * is sent to `/load`. Verified with Caddy 2.7.6 and 2.11.7, including after a restart
 * that adapts the files from disk (integration tests).
 *
 * Limits: it fingerprints the whole config, so any other change (e.g. a manual
 * reload of an edited main Caddyfile) also changes it. A mismatch therefore
 * means "not exactly this revision", never "the managed part is wrong".
 */
export function configFingerprint(config: unknown): string {
  return createHash("sha256").update(canonicalJson(config)).digest("hex");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}
