export interface LoginThrottleOptions {
  maxFailures?: number;
  windowMs?: number;
  /** Upper bound for tracked keys, so the map cannot grow without limit. */
  maxEntries?: number;
}

interface Entry {
  failures: number;
  windowEndsAt: number;
}

/**
 * In-memory, fixed-window limiter for failed logins (per client IP).
 * Sufficient for a single instance; nothing is persisted (no IP storage).
 */
export class LoginThrottle {
  readonly #maxFailures: number;
  readonly #windowMs: number;
  readonly #maxEntries: number;
  readonly #entries = new Map<string, Entry>();

  constructor({
    maxFailures = 5,
    windowMs = 15 * 60 * 1000,
    maxEntries = 10_000,
  }: LoginThrottleOptions = {}) {
    this.#maxFailures = maxFailures;
    this.#windowMs = windowMs;
    this.#maxEntries = maxEntries;
  }

  isBlocked(key: string, now: number = Date.now()): boolean {
    const entry = this.#current(key, now);
    return entry !== undefined && entry.failures >= this.#maxFailures;
  }

  recordFailure(key: string, now: number = Date.now()): void {
    const entry = this.#current(key, now);
    if (entry) {
      entry.failures += 1;
      return;
    }
    if (this.#entries.size >= this.#maxEntries) this.#prune(now);
    this.#entries.set(key, { failures: 1, windowEndsAt: now + this.#windowMs });
  }

  reset(key: string): void {
    this.#entries.delete(key);
  }

  #current(key: string, now: number): Entry | undefined {
    const entry = this.#entries.get(key);
    if (entry && entry.windowEndsAt <= now) {
      this.#entries.delete(key);
      return undefined;
    }
    return entry;
  }

  #prune(now: number): void {
    for (const [key, entry] of this.#entries) {
      if (entry.windowEndsAt <= now) this.#entries.delete(key);
    }
    // Still full: drop the oldest entries (Map preserves insertion order).
    for (const key of this.#entries.keys()) {
      if (this.#entries.size < this.#maxEntries) break;
      this.#entries.delete(key);
    }
  }
}
