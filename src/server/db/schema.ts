/**
 * Single entry point for drizzle-kit and the Drizzle client. Each module owns
 * its tables in `src/modules/<module>/schema.ts` and is re-exported here.
 * Relative paths on purpose: drizzle-kit does not resolve the `@/` alias.
 */
export * from "../../modules/auth/schema";
export * from "../../modules/caddy/schema";
export * from "../../modules/access-log/schema";
