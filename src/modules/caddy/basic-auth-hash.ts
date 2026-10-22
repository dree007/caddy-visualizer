import bcrypt from "bcryptjs";

/**
 * bcrypt cost of new hashes. Caddy's own `hash-password` uses 14; 12 keeps
 * saving (here) and the first check per client (in Caddy, which then caches
 * the result) at about a second on a single small vCPU.
 */
export const BASIC_AUTH_BCRYPT_COST = 12;

/** Server-side only; expects a password that passed `checkBasicAuthPassword`. */
export function hashBasicAuthPassword(
  password: string,
  cost = BASIC_AUTH_BCRYPT_COST,
): Promise<string> {
  return bcrypt.hash(password, cost);
}
