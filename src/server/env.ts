import { readFileSync } from "node:fs";
import { normalize } from "node:path";

import { z } from "zod";

import { parseCaddyAdminAddress } from "@/modules/caddy/admin-api";
import { CADDYFILE_PATH_PATTERN } from "@/modules/caddy/main-caddyfile";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

/** Absolute, normalized path that can be written into Caddyfile text as one token. */
const caddyPath = (fallback: string) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .refine(
        (value) =>
          CADDYFILE_PATH_PATTERN.test(value) &&
          normalize(value) === value &&
          !value.endsWith("/"),
        "absolute normalized path of the characters A–Z a–z 0–9 . _ - /",
      )
      .default(fallback),
  );

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_PATH: z
    .string()
    .min(1)
    .describe(
      "Path of the SQLite database file, e.g. /data/caddy-visualizer.db",
    ),
  ADMIN_USERNAME: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9][a-z0-9._-]{2,63}$/,
      "3–64 characters: a–z, 0–9, '.', '_' or '-', starting with a letter or digit",
    ),
  /** Plain HTTP without `Secure` cookies; only for trusted, isolated networks. */
  ALLOW_INSECURE_LAN_HTTP: z.preprocess(
    emptyToUndefined,
    z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  ),
  /**
   * Caddy admin API, e.g. `unix:///config/admin/admin.sock`. Optional: without
   * it the Caddy integration is not configured. Only ever used server-side.
   */
  CADDY_ADMIN_URL: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .transform((value, ctx) => {
        const result = parseCaddyAdminAddress(value);
        if (result.ok) return result.value;
        ctx.addIssue({ code: "custom", message: result.message });
        return z.NEVER;
      })
      .optional(),
  ),
  /** Main Caddyfile (read-only); same path in the manager and Caddy containers. */
  CADDY_MAIN_CADDYFILE: caddyPath("/etc/caddy/Caddyfile"),
  /** The manager's directory in Caddy's config volume; contains `sites.caddy`. */
  CADDY_MANAGED_DIR: caddyPath("/config/manager"),
  /** Caddy's JSON access log (read-only); source of metrics and logs. */
  CADDY_ACCESS_LOG_FILE: caddyPath("/config/logs/access.log"),
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  override name = "EnvError";
}

type EnvSource = Record<string, string | undefined>;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

/**
 * Validates environment variables. Error messages list variable names only,
 * never values, so secrets cannot leak into logs.
 */
export function parseEnv(source: EnvSource): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvError(
      `Invalid environment configuration:\n${formatIssues(result.error)}`,
    );
  }
  return result.data;
}

let cached: Env | undefined;

/**
 * Lazily parsed so that `next build` does not require runtime configuration.
 * Call only from server code that runs at request time, at start-up or in scripts.
 */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

const bootstrapSchema = z
  .object({
    ADMIN_INITIAL_PASSWORD: z.preprocess(
      emptyToUndefined,
      z.string().optional(),
    ),
    ADMIN_INITIAL_PASSWORD_FILE: z.preprocess(
      emptyToUndefined,
      z.string().optional(),
    ),
    ADMIN_RESET_PASSWORD: z.preprocess(
      emptyToUndefined,
      z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),
    ),
  })
  .refine(
    (env) => !(env.ADMIN_INITIAL_PASSWORD && env.ADMIN_INITIAL_PASSWORD_FILE),
    {
      message:
        "Set either ADMIN_INITIAL_PASSWORD or ADMIN_INITIAL_PASSWORD_FILE, not both",
    },
  );

const passwordSchema = z
  .string()
  .min(12, "must be at least 12 characters long")
  .max(1024, "must be at most 1024 characters long");

export interface AdminBootstrapSecrets {
  password?: string;
  resetPassword: boolean;
}

/**
 * Reads the initial admin password, preferably from a file (Docker secret).
 * Kept separate from `getEnv()` so the password is read once at start-up and
 * not kept in the long-lived configuration object.
 */
export function readAdminBootstrapSecrets(
  source: EnvSource,
  readFile: (path: string) => string = (path) => readFileSync(path, "utf8"),
): AdminBootstrapSecrets {
  const parsed = bootstrapSchema.safeParse(source);
  if (!parsed.success) {
    throw new EnvError(
      `Invalid admin bootstrap configuration:\n${formatIssues(parsed.error)}`,
    );
  }
  const {
    ADMIN_INITIAL_PASSWORD,
    ADMIN_INITIAL_PASSWORD_FILE,
    ADMIN_RESET_PASSWORD,
  } = parsed.data;

  let password = ADMIN_INITIAL_PASSWORD;
  let origin = "ADMIN_INITIAL_PASSWORD";
  if (ADMIN_INITIAL_PASSWORD_FILE) {
    origin = "ADMIN_INITIAL_PASSWORD_FILE";
    try {
      // Strip a single trailing newline as written by `echo` or editors.
      password = readFile(ADMIN_INITIAL_PASSWORD_FILE).replace(/\r?\n$/, "");
    } catch {
      throw new EnvError(`${origin}: file cannot be read`);
    }
  }

  if (password !== undefined) {
    const result = passwordSchema.safeParse(password);
    if (!result.success) {
      throw new EnvError(
        `${origin}: ${result.error.issues[0]?.message ?? "invalid"}`,
      );
    }
  }

  return { password, resetPassword: ADMIN_RESET_PASSWORD };
}
