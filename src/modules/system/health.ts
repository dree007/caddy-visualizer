export type ComponentStatus = "ok" | "error";

export interface HealthReport {
  status: ComponentStatus;
  checks: { database: ComponentStatus };
}

export interface HealthDependencies {
  /** Resolves if the database answers a trivial query. */
  pingDatabase: () => Promise<void>;
  timeoutMs?: number;
}

/**
 * Aggregates the health of the app's dependencies. Errors are reduced to a
 * status on purpose: the endpoint is unauthenticated and must not leak details.
 */
export async function checkHealth({
  pingDatabase,
  timeoutMs = 2000,
}: HealthDependencies): Promise<HealthReport> {
  const database = await withTimeout(pingDatabase(), timeoutMs).then(
    () => "ok" as const,
    () => "error" as const,
  );
  return { status: database, checks: { database } };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
