import { z } from "zod";

import { code } from "@/i18n/codes";

import { formatUpstream, parseUpstream } from "./upstream";
import { parseHeaderName } from "./upstream-headers";

/*
 * Native Caddy load balancing of a proxy site (`reverse_proxy` with several
 * upstreams). Only options Caddy's `reverse_proxy` actually has, under their
 * Caddyfile names; nothing is balanced or retried by this application.
 */

/** `lb_policy` values offered in the form (Caddy ≥ 2.7). */
export const LB_POLICIES = [
  "random",
  "round_robin",
  "weighted_round_robin",
  "least_conn",
  "first",
  "ip_hash",
  "uri_hash",
  "header",
  "cookie",
] as const;
export type LbPolicy = (typeof LB_POLICIES)[number];

/**
 * Methods a retry may resend: idempotent ones only (RFC 9110 9.2.2), so a
 * retried request cannot create a duplicate POST or PATCH. Caddy's own
 * default without `lb_retry_match` is GET only.
 */
export const RETRY_METHODS = [
  "GET",
  "HEAD",
  "OPTIONS",
  "PUT",
  "DELETE",
] as const;
export type RetryMethod = (typeof RETRY_METHODS)[number];

export const BACKENDS_MIN = 2;
export const BACKENDS_MAX = 20;
export const LABEL_MAX_LENGTH = 60;
export const WEIGHT_MAX = 100;
export const HEALTH_URI_MAX_LENGTH = 256;
export const COOKIE_NAME_MAX_LENGTH = 64;
const STATUSES_MAX = 10;

export interface Backend {
  /** Canonical `http(s)://host[:port]`. */
  upstream: string;
  /** For the UI only; never written to the Caddyfile. */
  label: string;
  /** Used by `weighted_round_robin` only. */
  weight: number;
  /** Disabled backends stay stored but are left out of the Caddyfile. */
  enabled: boolean;
}

export interface ActiveHealth {
  uri: string;
  interval: string;
  timeout: string;
  /** `200` or a class such as `2xx`. */
  status: string;
  fails: number;
  passes: number;
}

export interface PassiveHealth {
  failDuration: string;
  maxFails: number;
  unhealthyStatus: string[];
  unhealthyLatency: string | null;
}

export interface Retries {
  /** `lb_retries`; null = only the duration limits retries. */
  count: number | null;
  /** `lb_try_duration`; null = only the count limits retries. */
  duration: string | null;
  /** `lb_try_interval`; null = Caddy's default (250ms). */
  interval: string | null;
  methods: RetryMethod[];
}

export interface LoadBalancing {
  backends: Backend[];
  policy: LbPolicy;
  /** Header field of the `header` policy. */
  header: string | null;
  /** Cookie name of the `cookie` policy. */
  cookie: string | null;
  activeHealth: ActiveHealth | null;
  passiveHealth: PassiveHealth | null;
  retries: Retries | null;
}

/** The form's state: every value as typed, settings of switched-off parts kept. */
export interface LoadBalancingInput {
  backends: {
    upstream: string;
    label: string;
    weight: string;
    enabled: boolean;
  }[];
  policy: string;
  header: string;
  cookie: string;
  active: boolean;
  healthUri: string;
  healthInterval: string;
  healthTimeout: string;
  healthStatus: string;
  healthFails: string;
  healthPasses: string;
  passive: boolean;
  failDuration: string;
  maxFails: string;
  unhealthyStatus: string;
  unhealthyLatency: string;
  retries: boolean;
  retryCount: string;
  tryDuration: string;
  tryInterval: string;
  retryMethods: string[];
}

/** Error key of a load balancing field, e.g. `lb.healthUri` or `lb.backends.1.upstream`. */
export type LbFieldKey =
  | `lb.${Exclude<keyof LoadBalancingInput, "backends">}`
  | "lb.backends"
  | `lb.backends.${number}.${"upstream" | "label" | "weight"}`;
export type LbErrors = Partial<Record<LbFieldKey, string>>;

/** Starting values; Caddy's defaults where it has them. */
export function defaultLoadBalancingInput(upstream = ""): LoadBalancingInput {
  return {
    backends: [
      { upstream, label: "", weight: "1", enabled: true },
      { upstream: "", label: "", weight: "1", enabled: true },
    ],
    policy: "round_robin",
    header: "",
    cookie: "lb",
    active: false,
    healthUri: "/health",
    healthInterval: "30s",
    healthTimeout: "5s",
    healthStatus: "2xx",
    healthFails: "1",
    healthPasses: "1",
    passive: false,
    failDuration: "30s",
    maxFails: "1",
    unhealthyStatus: "5xx",
    unhealthyLatency: "",
    retries: false,
    retryCount: "2",
    tryDuration: "",
    tryInterval: "250ms",
    retryMethods: ["GET"],
  };
}

/** A stored configuration as form values (for editing and for re-validation). */
export function toLoadBalancingInput(lb: LoadBalancing): LoadBalancingInput {
  const defaults = defaultLoadBalancingInput();
  const { activeHealth: a, passiveHealth: p, retries: r } = lb;
  return {
    backends: lb.backends.map((backend) => ({
      ...backend,
      weight: String(backend.weight),
    })),
    policy: lb.policy,
    header: lb.header ?? "",
    cookie: lb.cookie ?? defaults.cookie,
    active: a !== null,
    healthUri: a?.uri ?? defaults.healthUri,
    healthInterval: a?.interval ?? defaults.healthInterval,
    healthTimeout: a?.timeout ?? defaults.healthTimeout,
    healthStatus: a?.status ?? defaults.healthStatus,
    healthFails: String(a?.fails ?? defaults.healthFails),
    healthPasses: String(a?.passes ?? defaults.healthPasses),
    passive: p !== null,
    failDuration: p?.failDuration ?? defaults.failDuration,
    maxFails: String(p?.maxFails ?? defaults.maxFails),
    unhealthyStatus: p ? p.unhealthyStatus.join(" ") : defaults.unhealthyStatus,
    unhealthyLatency: p?.unhealthyLatency ?? "",
    retries: r !== null,
    retryCount: r
      ? r.count === null
        ? ""
        : String(r.count)
      : defaults.retryCount,
    tryDuration: r?.duration ?? "",
    tryInterval: r ? (r.interval ?? "") : defaults.tryInterval,
    retryMethods: r?.methods ?? defaults.retryMethods,
  };
}

const text = z.string().max(2048).catch("");
const flag = z.boolean().catch(false);
/** Shape only; every value is checked in `checkLoadBalancing`. */
const inputSchema = z.object({
  backends: z
    .array(
      z.object({
        upstream: text,
        label: text,
        weight: text,
        enabled: flag,
      }),
    )
    .max(BACKENDS_MAX * 2),
  policy: text,
  header: text,
  cookie: text,
  active: flag,
  healthUri: text,
  healthInterval: text,
  healthTimeout: text,
  healthStatus: text,
  healthFails: text,
  healthPasses: text,
  passive: flag,
  failDuration: text,
  maxFails: text,
  unhealthyStatus: text,
  unhealthyLatency: text,
  retries: flag,
  retryCount: text,
  tryDuration: text,
  tryInterval: text,
  retryMethods: z.array(z.string()).max(20).catch([]),
});

/** Untrusted form data in the form's shape; anything else becomes empty upstream rows. */
export function parseLoadBalancingInput(raw: unknown): LoadBalancingInput {
  const result = inputSchema.safeParse(raw);
  return result.success ? result.data : defaultLoadBalancingInput();
}

export interface LoadBalancingCheck {
  /** Null when any field is invalid. */
  value: LoadBalancing | null;
  /** The first backend, canonical, when valid: the site's `upstream`. */
  upstream: string | null;
}

/**
 * Validates untrusted load balancing input. Errors go to `errors` under their
 * field key; only settings of the switched-on parts and the chosen policy are
 * checked (hidden values are kept by the form, never stored).
 */
export function checkLoadBalancing(
  raw: unknown,
  errors: LbErrors,
): LoadBalancingCheck {
  const shape = inputSchema.safeParse(raw);
  if (!shape.success) {
    errors["lb.backends"] = code("validation.invalid");
    return { value: null, upstream: null };
  }
  const input = shape.data;
  const before = Object.keys(errors).length;
  const policy = (LB_POLICIES as readonly string[]).includes(input.policy)
    ? (input.policy as LbPolicy)
    : null;
  if (!policy) errors["lb.policy"] = code("lb.policy");

  const backends: Backend[] = [];
  const seen = new Set<string>();
  let scheme: string | null = null;
  let first: string | null = null;
  input.backends.forEach((row, index) => {
    const key = `lb.backends.${index}` as const;
    const parsedUpstream = parseUpstream(row.upstream);
    let upstream: string | null = null;
    if (!parsedUpstream.ok) {
      errors[`${key}.upstream`] = parsedUpstream.message;
    } else {
      upstream = formatUpstream(parsedUpstream.value);
      if (seen.has(upstream)) {
        errors[`${key}.upstream`] = code("lb.duplicate");
      } else if (scheme !== null && parsedUpstream.value.scheme !== scheme) {
        // Caddy refuses mixed schemes in one reverse_proxy.
        errors[`${key}.upstream`] = code("lb.mixedSchemes");
      }
      seen.add(upstream);
      scheme ??= parsedUpstream.value.scheme;
      if (index === 0) first = upstream;
    }
    const label = row.label.trim();
    if (label.length > LABEL_MAX_LENGTH || /[\x00-\x1f\x7f]/.test(label)) {
      errors[`${key}.label`] = code("lb.label", { max: LABEL_MAX_LENGTH });
    }
    const weight = integer(row.weight, 0, WEIGHT_MAX);
    if (policy === "weighted_round_robin" && weight === null) {
      errors[`${key}.weight`] = code("lb.weight", { max: WEIGHT_MAX });
    }
    if (upstream !== null) {
      backends.push({
        upstream,
        label,
        weight: weight ?? 1,
        enabled: row.enabled,
      });
    }
  });
  if (
    input.backends.length < BACKENDS_MIN ||
    input.backends.length > BACKENDS_MAX
  ) {
    errors["lb.backends"] = code("lb.backendsCount", {
      min: BACKENDS_MIN,
      max: BACKENDS_MAX,
    });
  } else if (!input.backends.some((row) => row.enabled)) {
    errors["lb.backends"] = code("lb.noneEnabled");
  } else if (
    policy === "weighted_round_robin" &&
    backends.every((backend) => !backend.enabled || backend.weight === 0)
  ) {
    errors["lb.backends"] = code("lb.weightsZero");
  }

  let header: string | null = null;
  if (policy === "header") {
    const name = parseHeaderName(input.header);
    if (name.ok) header = name.value;
    else errors["lb.header"] = name.message;
  }
  let cookie: string | null = null;
  if (policy === "cookie") {
    const name = input.cookie.trim();
    if (COOKIE_NAME.test(name)) cookie = name;
    else errors["lb.cookie"] = code("lb.cookie");
  }

  const check = <T>(key: LbFieldKey, value: T | null, message: string) => {
    if (value === null) errors[key] = message;
    return value;
  };
  const durationCode = (min: string, max: string) =>
    code("lb.duration", { min, max });

  let activeHealth: ActiveHealth | null = null;
  if (input.active) {
    const uri = input.healthUri.trim();
    const parts = {
      uri: check(
        "lb.healthUri",
        HEALTH_URI.test(uri) && uri.length <= HEALTH_URI_MAX_LENGTH
          ? uri
          : null,
        code("lb.healthUri"),
      ),
      interval: check(
        "lb.healthInterval",
        duration(input.healthInterval, 1_000, 24 * HOUR),
        durationCode("1s", "24h"),
      ),
      timeout: check(
        "lb.healthTimeout",
        duration(input.healthTimeout, 100, 5 * MINUTE),
        durationCode("100ms", "5m"),
      ),
      status: check(
        "lb.healthStatus",
        status(input.healthStatus),
        code("lb.status"),
      ),
      fails: check(
        "lb.healthFails",
        integer(input.healthFails, 1, 100),
        code("lb.count", { min: 1, max: 100 }),
      ),
      passes: check(
        "lb.healthPasses",
        integer(input.healthPasses, 1, 100),
        code("lb.count", { min: 1, max: 100 }),
      ),
    };
    if (Object.values(parts).every((part) => part !== null)) {
      activeHealth = parts as ActiveHealth;
    }
  }

  let passiveHealth: PassiveHealth | null = null;
  if (input.passive) {
    const statuses = input.unhealthyStatus.split(/[\s,]+/).filter(Boolean);
    const unhealthyStatus = statuses.map(status);
    const latency = input.unhealthyLatency.trim();
    const parts = {
      failDuration: check(
        "lb.failDuration",
        duration(input.failDuration, 1_000, 24 * HOUR),
        durationCode("1s", "24h"),
      ),
      maxFails: check(
        "lb.maxFails",
        integer(input.maxFails, 1, 100),
        code("lb.count", { min: 1, max: 100 }),
      ),
      unhealthyStatus: check(
        "lb.unhealthyStatus",
        unhealthyStatus.every((value) => value !== null) &&
          statuses.length <= STATUSES_MAX
          ? [...new Set(unhealthyStatus as string[])]
          : null,
        code("lb.statusList", { max: STATUSES_MAX }),
      ),
      unhealthyLatency:
        latency === ""
          ? ("" as const)
          : check(
              "lb.unhealthyLatency",
              duration(latency, 1, 10 * MINUTE),
              durationCode("1ms", "10m"),
            ),
    };
    if (Object.values(parts).every((part) => part !== null)) {
      passiveHealth = {
        failDuration: parts.failDuration!,
        maxFails: parts.maxFails!,
        unhealthyStatus: parts.unhealthyStatus!,
        unhealthyLatency: parts.unhealthyLatency || null,
      };
    }
  }

  let retries: Retries | null = null;
  if (input.retries) {
    const optional = <T>(
      key: LbFieldKey,
      value: string,
      parse: (value: string) => T | null,
      message: string,
    ): T | null | undefined => {
      if (value.trim() === "") return null;
      const result = parse(value);
      if (result === null) {
        errors[key] = message;
        return undefined;
      }
      return result;
    };
    const count = optional(
      "lb.retryCount",
      input.retryCount,
      (value) => integer(value, 1, 10),
      code("lb.count", { min: 1, max: 10 }),
    );
    const tryDuration = optional(
      "lb.tryDuration",
      input.tryDuration,
      (value) => duration(value, 1_000, 5 * MINUTE),
      durationCode("1s", "5m"),
    );
    // Never 0: with all upstreams down, a zero interval spins the CPU.
    const interval = optional(
      "lb.tryInterval",
      input.tryInterval,
      (value) => duration(value, 10, MINUTE),
      durationCode("10ms", "1m"),
    );
    const methods = RETRY_METHODS.filter((method) =>
      input.retryMethods.includes(method),
    );
    if (
      methods.length === 0 ||
      input.retryMethods.some(
        (method) => !(RETRY_METHODS as readonly string[]).includes(method),
      )
    ) {
      errors["lb.retryMethods"] = code("lb.retryMethods");
    }
    if (count === null && tryDuration === null) {
      errors["lb.retryCount"] ??= code("lb.retryLimit");
    }
    if (
      count !== undefined &&
      tryDuration !== undefined &&
      interval !== undefined &&
      (count !== null || tryDuration !== null) &&
      methods.length > 0
    ) {
      retries = { count, duration: tryDuration, interval, methods };
    }
  }

  if (Object.keys(errors).length > before || policy === null) {
    return { value: null, upstream: first };
  }
  return {
    value: {
      backends,
      policy,
      header,
      cookie,
      activeHealth,
      passiveHealth,
      retries,
    },
    upstream: first,
  };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const UNIT_MS = { ms: 1, s: 1_000, m: MINUTE, h: HOUR } as const;
const DURATION = /^([1-9][0-9]{0,6})(ms|s|m|h)$/;
const STATUS = /^[1-5](?:[0-9]{2}|xx)$/;
const INTEGER = /^(?:0|[1-9][0-9]{0,5})$/;
/** Path and optional query: the characters of the renderer's path token. */
const HEALTH_URI = /^\/[A-Za-z0-9\-._~/%?=&:+,;]*$/;
const COOKIE_NAME = new RegExp(
  `^[A-Za-z0-9][A-Za-z0-9_-]{0,${COOKIE_NAME_MAX_LENGTH - 1}}$`,
);

/** A Caddy duration such as `250ms`, `10s`, `5m` within [min, max] milliseconds. */
function duration(input: string, min: number, max: number): string | null {
  const value = input.trim();
  const match = DURATION.exec(value);
  if (!match) return null;
  const ms = Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
  return ms >= min && ms <= max ? value : null;
}

function integer(input: string, min: number, max: number): number | null {
  const value = input.trim();
  if (!INTEGER.test(value)) return null;
  const number = Number(value);
  return number >= min && number <= max ? number : null;
}

/** `503` or a class such as `5xx`. */
function status(input: string): string | null {
  const value = input.trim().toLowerCase();
  return STATUS.test(value) ? value : null;
}

/** Shape of a stored configuration (its values are re-checked by `checkLoadBalancing`). */
const storedSchema = z.object({
  backends: z.array(
    z.object({
      upstream: z.string(),
      label: z.string(),
      weight: z.number(),
      enabled: z.boolean(),
    }),
  ),
  policy: z.enum(LB_POLICIES),
  header: z.string().nullable(),
  cookie: z.string().nullable(),
  activeHealth: z
    .object({
      uri: z.string(),
      interval: z.string(),
      timeout: z.string(),
      status: z.string(),
      fails: z.number(),
      passes: z.number(),
    })
    .nullable(),
  passiveHealth: z
    .object({
      failDuration: z.string(),
      maxFails: z.number(),
      unhealthyStatus: z.array(z.string()),
      unhealthyLatency: z.string().nullable(),
    })
    .nullable(),
  retries: z
    .object({
      count: z.number().nullable(),
      duration: z.string().nullable(),
      interval: z.string().nullable(),
      methods: z.array(z.enum(RETRY_METHODS)),
    })
    .nullable(),
});

/**
 * A stored configuration (database row, revision snapshot): the same rules as
 * the form, so nothing that bypassed them reaches the generator.
 */
export const storedLoadBalancingSchema = storedSchema.transform(
  (stored, ctx) => {
    const errors: LbErrors = {};
    const { value } = checkLoadBalancing(toLoadBalancingInput(stored), errors);
    if (value === null) {
      ctx.addIssue({ code: "custom", message: "invalid load balancing" });
      return z.NEVER;
    }
    return value;
  },
);

/**
 * `host:port` Caddy dials for a canonical upstream, as in its access log
 * placeholder `{upstream_hostport}` and its `upstream` metric label.
 */
export function dialAddress(upstream: string): string | null {
  const parsed = parseUpstream(upstream);
  if (!parsed.ok) return null;
  const { scheme, host, port } = parsed.value;
  return `${host}:${port ?? (scheme === "https" ? 443 : 80)}`;
}

/**
 * Caddy's own view of upstream health from its Prometheus metrics: the gauge
 * `caddy_reverse_proxy_upstreams_healthy{upstream="host:port"}` (1 healthy,
 * 0 not), refreshed by Caddy every 10 s. Shared by all sites that use the same
 * address, like Caddy's upstream pool itself.
 */
export function parseUpstreamHealth(metrics: string): Map<string, boolean> {
  const health = new Map<string, boolean>();
  for (const match of metrics.matchAll(HEALTHY_GAUGE)) {
    health.set(match[1]!.toLowerCase(), match[2] === "1");
  }
  return health;
}

const HEALTHY_GAUGE =
  /^caddy_reverse_proxy_upstreams_healthy\{upstream="([^"\\]{1,300})"\} ([01])(?:\.0+)?(?:e\+?0+)?\s*$/gm;
