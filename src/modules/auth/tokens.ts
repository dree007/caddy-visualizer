import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes, base64url without padding. */
export const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Tokens carry 256 bits of entropy, so a fast hash is sufficient: the stored
 * hash cannot be reversed or brute-forced into a usable token.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
