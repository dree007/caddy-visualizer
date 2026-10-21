import { argon2, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with Argon2id from `node:crypto` (Node.js >= 24.7, backed by
 * OpenSSL >= 3.2). Node provides the raw KDF only; this module adds the
 * standard PHC string encoding so hashes are self-describing and portable:
 *
 *   $argon2id$v=19$m=19456,t=2,p=1$<salt, base64>$<hash, base64>
 */

export interface Argon2Params {
  /** Memory cost in KiB. */
  memory: number;
  /** Number of passes (iterations). */
  passes: number;
  parallelism: number;
}

/** OWASP Password Storage Cheat Sheet, Argon2id minimum configuration. */
export const DEFAULT_ARGON2_PARAMS: Readonly<Argon2Params> = {
  memory: 19_456,
  passes: 2,
  parallelism: 1,
};

const SALT_BYTES = 16;
const HASH_BYTES = 32;
const ARGON2_VERSION = 19;

// Upper bounds guard against absurd parameters in a corrupted hash string.
const MAX_MEMORY_KIB = 1_048_576;
const MAX_PASSES = 100;
const MAX_PARALLELISM = 64;

const PHC_PATTERN =
  /^\$argon2id\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

interface ParsedHash {
  params: Argon2Params;
  salt: Buffer;
  hash: Buffer;
}

if (typeof argon2 !== "function") {
  throw new Error(
    "node:crypto argon2 is not available. Node.js >= 24.7 with OpenSSL >= 3.2 is required.",
  );
}

function deriveKey(
  password: string,
  salt: Buffer,
  params: Argon2Params,
  length: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2(
      "argon2id",
      {
        message: password,
        nonce: salt,
        memory: params.memory,
        passes: params.passes,
        parallelism: params.parallelism,
        tagLength: length,
      },
      (error, derivedKey) => (error ? reject(error) : resolve(derivedKey)),
    );
  });
}

const toB64 = (buffer: Buffer) => buffer.toString("base64").replace(/=+$/, "");

export async function hashPassword(
  password: string,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS,
): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await deriveKey(password, salt, params, HASH_BYTES);
  return `$argon2id$v=${ARGON2_VERSION}$m=${params.memory},t=${params.passes},p=${params.parallelism}$${toB64(salt)}$${toB64(hash)}`;
}

function parseHash(encoded: string): ParsedHash | null {
  const match = PHC_PATTERN.exec(encoded);
  if (!match) return null;
  const [, version, memory, passes, parallelism, salt, hash] = match;
  const params = {
    memory: Number(memory),
    passes: Number(passes),
    parallelism: Number(parallelism),
  };
  if (
    Number(version) !== ARGON2_VERSION ||
    params.memory > MAX_MEMORY_KIB ||
    params.passes < 1 ||
    params.passes > MAX_PASSES ||
    params.parallelism < 1 ||
    params.parallelism > MAX_PARALLELISM ||
    params.memory < 8 * params.parallelism
  ) {
    return null;
  }
  const parsed = {
    params,
    salt: Buffer.from(salt!, "base64"),
    hash: Buffer.from(hash!, "base64"),
  };
  if (parsed.salt.length < 8 || parsed.hash.length < 16) return null;
  return parsed;
}

/** Returns `false` for wrong passwords and for malformed hashes; never throws on bad input. */
export async function verifyPassword(
  encoded: string,
  password: string,
): Promise<boolean> {
  const parsed = parseHash(encoded);
  if (!parsed) return false;
  const candidate = await deriveKey(
    password,
    parsed.salt,
    parsed.params,
    parsed.hash.length,
  );
  return timingSafeEqual(candidate, parsed.hash);
}

/** True if the hash was created with different parameters and should be upgraded on next login. */
export function needsRehash(
  encoded: string,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS,
): boolean {
  const parsed = parseHash(encoded);
  if (!parsed) return true;
  return (
    parsed.params.memory !== params.memory ||
    parsed.params.passes !== params.passes ||
    parsed.params.parallelism !== params.parallelism
  );
}
