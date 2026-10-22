import { randomUUID } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";

import type { Db } from "@/server/db/client";

import { code } from "@/i18n/codes";

import { hashBasicAuthPassword } from "./basic-auth-hash";
import {
  type SiteFieldErrors,
  validateSiteInput,
  type ValidSiteInput,
} from "./contracts";
import { type GeneratedSitesCaddy, generateSitesCaddy } from "./generator";
import { type CaddySiteRow, caddySites } from "./schema";

export type ManagedSite = CaddySiteRow;

export type SiteError =
  | { code: "validation"; fieldErrors: SiteFieldErrors }
  | { code: "not-found" }
  /** The site changed since the editor loaded it (optimistic locking). */
  | { code: "conflict" };

export type SiteResult<T> =
  { ok: true; value: T } | { ok: false; error: SiteError };

const HOSTNAME_TAKEN: SiteError = {
  code: "validation",
  fieldErrors: {
    hostname: code("site.duplicate"),
  },
};
const NOT_FOUND: SiteError = { code: "not-found" };
const CONFLICT: SiteError = { code: "conflict" };

const fail = (error: SiteError) => ({ ok: false, error }) as const;

type HashPassword = (password: string) => Promise<string>;

/** The stored columns of validated input; hashes a new password, keeps the old hash otherwise. */
async function storedValues(
  { basicAuth, ...values }: ValidSiteInput,
  existingHash: string | null,
  hash: HashPassword,
): Promise<Omit<ManagedSite, "id" | "createdAt" | "updatedAt">> {
  if (!basicAuth) {
    return { ...values, basicAuthUsername: null, basicAuthHash: null };
  }
  return {
    ...values,
    basicAuthUsername: basicAuth.username,
    basicAuthHash:
      basicAuth.password === null
        ? existingHash
        : await hash(basicAuth.password),
  };
}

/** Creates a site from untrusted input (validated and normalized here). */
export async function createSite(
  db: Db,
  input: unknown,
  now: Date = new Date(),
  hash: HashPassword = hashBasicAuthPassword,
): Promise<SiteResult<ManagedSite>> {
  const validation = validateSiteInput(input);
  if (!validation.ok) {
    return fail({ code: "validation", fieldErrors: validation.fieldErrors });
  }
  if (await hostnameTaken(db, validation.value.hostname)) {
    return fail(HOSTNAME_TAKEN);
  }

  const site: ManagedSite = {
    id: randomUUID(),
    ...(await storedValues(validation.value, null, hash)),
    createdAt: now,
    updatedAt: now,
  };
  try {
    await db.insert(caddySites).values(site);
  } catch (error) {
    if (isUniqueViolation(error)) return fail(HOSTNAME_TAKEN);
    throw error;
  }
  return { ok: true, value: site };
}

export async function getSite(db: Db, id: string): Promise<ManagedSite | null> {
  const [site] = await db
    .select()
    .from(caddySites)
    .where(eq(caddySites.id, id))
    .limit(1);
  return site ?? null;
}

/** All managed sites, ordered by hostname. */
export async function listSites(db: Db): Promise<ManagedSite[]> {
  return db.select().from(caddySites).orderBy(asc(caddySites.hostname));
}

/** Enabled sites only, ordered by hostname. */
export async function listEnabledSites(db: Db): Promise<ManagedSite[]> {
  return db
    .select()
    .from(caddySites)
    .where(eq(caddySites.enabled, true))
    .orderBy(asc(caddySites.hostname));
}

/**
 * Replaces all editable fields of a site with validated input. With
 * `expectedUpdatedAt` (the version the editor was opened with) the update only
 * happens if nobody changed the site in between; otherwise `conflict`. An
 * empty basic auth password keeps the stored hash.
 */
export async function updateSite(
  db: Db,
  id: string,
  input: unknown,
  now: Date = new Date(),
  expectedUpdatedAt?: Date,
  hash: HashPassword = hashBasicAuthPassword,
): Promise<SiteResult<ManagedSite>> {
  const existing = await getSite(db, id);
  const validation = validateSiteInput(input, {
    storedPassword: Boolean(existing?.basicAuthHash),
  });
  if (!validation.ok) {
    return fail({ code: "validation", fieldErrors: validation.fieldErrors });
  }
  if (!existing) return fail(NOT_FOUND);
  if (
    expectedUpdatedAt &&
    existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()
  ) {
    return fail(CONFLICT);
  }
  if (await hostnameTaken(db, validation.value.hostname, id)) {
    return fail(HOSTNAME_TAKEN);
  }
  const values = await storedValues(
    validation.value,
    existing.basicAuthHash,
    hash,
  );
  return applyUpdate(db, existing, values, now, expectedUpdatedAt);
}

/** Enables or disables a site without touching its other fields. */
export async function setSiteEnabled(
  db: Db,
  id: string,
  enabled: boolean,
  now: Date = new Date(),
): Promise<SiteResult<ManagedSite>> {
  const existing = await getSite(db, id);
  if (!existing) return fail(NOT_FOUND);
  if (existing.enabled === enabled) return { ok: true, value: existing };

  const updated = { ...existing, enabled, updatedAt: now };
  await db
    .update(caddySites)
    .set({ enabled, updatedAt: now })
    .where(eq(caddySites.id, id));
  return { ok: true, value: updated };
}

/** Removes a site from the managed configuration (unlike disabling it). */
export async function deleteSite(
  db: Db,
  id: string,
): Promise<SiteResult<{ id: string }>> {
  const deleted = await db
    .delete(caddySites)
    .where(eq(caddySites.id, id))
    .returning({ id: caddySites.id });
  return deleted.length === 0 ? fail(NOT_FOUND) : { ok: true, value: { id } };
}

/** Generates `sites.caddy` from the currently enabled sites (no file is written). */
export async function generateSitesCaddyFromDb(
  db: Db,
): Promise<GeneratedSitesCaddy> {
  return generateSitesCaddy(await listEnabledSites(db));
}

async function applyUpdate(
  db: Db,
  existing: ManagedSite,
  values: Omit<ManagedSite, "id" | "createdAt" | "updatedAt">,
  now: Date,
  expectedUpdatedAt?: Date,
): Promise<SiteResult<ManagedSite>> {
  const updated: ManagedSite = { ...existing, ...values, updatedAt: now };
  let changed: { id: string }[];
  try {
    // The version check is part of the UPDATE itself, so a concurrent write
    // between the read above and this statement is detected as well.
    changed = await db
      .update(caddySites)
      .set({ ...values, updatedAt: now })
      .where(
        expectedUpdatedAt
          ? and(
              eq(caddySites.id, existing.id),
              eq(caddySites.updatedAt, expectedUpdatedAt),
            )
          : eq(caddySites.id, existing.id),
      )
      .returning({ id: caddySites.id });
  } catch (error) {
    if (isUniqueViolation(error)) return fail(HOSTNAME_TAKEN);
    throw error;
  }
  if (changed.length === 0)
    return fail(expectedUpdatedAt ? CONFLICT : NOT_FOUND);
  return { ok: true, value: updated };
}

async function hostnameTaken(
  db: Db,
  hostname: string,
  exceptId?: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: caddySites.id })
    .from(caddySites)
    .where(eq(caddySites.hostname, hostname))
    .limit(1);
  return row !== undefined && row.id !== exceptId;
}

/** better-sqlite3 error code, possibly wrapped by Drizzle as `cause`. */
function isUniqueViolation(error: unknown): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    if ((current as { code?: unknown }).code === "SQLITE_CONSTRAINT_UNIQUE") {
      return true;
    }
  }
  return false;
}
