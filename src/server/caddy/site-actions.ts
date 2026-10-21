"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { RevisionTrigger } from "@/modules/caddy/schema";
import {
  createSite,
  deleteSite,
  type ManagedSite,
  setSiteEnabled,
  type SiteResult,
  updateSite,
} from "@/modules/caddy/sites";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/server/auth/session";
import { getDb } from "@/server/db";

import { applyAfterChange } from "./apply";
import {
  type ApplyOutcome,
  type SiteActionResult,
  type SiteFormState,
  siteFormValues,
} from "./site-form";

/*
 * Server Actions of the config UI. Every action is a public POST endpoint, so
 * each one checks the session itself (redirects to /login otherwise) and passes
 * untrusted input to the repository, which validates via the domain contract.
 * After a successful change the desired state is applied to Caddy (server-side
 * apply engine). A failed apply never undoes the stored change.
 */

const siteId = z.uuid();
/** `updatedAt` (epoch ms) of the version the editor was opened with. */
const siteVersion = z.coerce.number().int().positive();

export async function createSiteAction(
  previous: SiteFormState,
  formData: FormData,
): Promise<SiteFormState> {
  await requireSession();
  const { t } = await getI18n();
  const values = siteFormValues(formData);
  const attempt = previous.attempt + 1;

  let result: SiteResult<ManagedSite>;
  try {
    result = await createSite(getDb(), values);
  } catch (error) {
    console.error("Creating a site failed", error);
    return { values, formError: t.actions.siteSaveFailed, attempt };
  }
  if (!result.ok) {
    return result.error.code === "validation"
      ? { values, fieldErrors: result.error.fieldErrors, attempt }
      : { values, formError: t.actions.siteSaveFailed, attempt };
  }

  const outcome = await applyAfterChange("site-created");
  revalidatePath("/config", "layout");
  redirect(noticeUrl("created", result.value.hostname, outcome));
}

export async function updateSiteAction(
  previous: SiteFormState,
  formData: FormData,
): Promise<SiteFormState> {
  await requireSession();
  const { t } = await getI18n();
  const values = siteFormValues(formData);
  const attempt = previous.attempt + 1;
  const id = siteId.safeParse(formData.get("id"));
  if (!id.success) return { values, formError: t.actions.siteGone, attempt };
  const version = siteVersion.safeParse(formData.get("version"));
  if (!version.success)
    return { values, formError: t.actions.siteConflict, attempt };

  let result: SiteResult<ManagedSite>;
  try {
    result = await updateSite(
      getDb(),
      id.data,
      values,
      new Date(),
      new Date(version.data),
    );
  } catch (error) {
    console.error("Updating a site failed", error);
    return { values, formError: t.actions.siteSaveFailed, attempt };
  }
  if (!result.ok) {
    switch (result.error.code) {
      case "validation":
        return { values, fieldErrors: result.error.fieldErrors, attempt };
      case "conflict":
        return { values, formError: t.actions.siteConflict, attempt };
      case "not-found":
        return { values, formError: t.actions.siteGone, attempt };
    }
  }

  const outcome = await applyAfterChange("site-updated");
  revalidatePath("/config", "layout");
  redirect(noticeUrl("updated", result.value.hostname, outcome));
}

export async function setSiteEnabledAction(
  id: unknown,
  enabled: unknown,
): Promise<SiteActionResult> {
  await requireSession();
  const { t } = await getI18n();
  const parsedId = siteId.safeParse(id);
  if (!parsedId.success || typeof enabled !== "boolean") {
    return { ok: false, message: t.actions.changeFailed };
  }

  let result: SiteResult<ManagedSite>;
  try {
    result = await setSiteEnabled(getDb(), parsedId.data, enabled);
  } catch (error) {
    console.error("Enabling/disabling a site failed", error);
    return { ok: false, message: t.actions.changeFailed };
  }
  if (!result.ok) {
    revalidatePath("/config", "layout");
    return { ok: false, message: t.actions.siteGone };
  }
  return applied(enabled ? "site-enabled" : "site-disabled");
}

export async function deleteSiteAction(id: unknown): Promise<SiteActionResult> {
  await requireSession();
  const { t } = await getI18n();
  const parsedId = siteId.safeParse(id);
  if (!parsedId.success) return { ok: false, message: t.actions.deleteFailed };

  let result: SiteResult<{ id: string }>;
  try {
    result = await deleteSite(getDb(), parsedId.data);
  } catch (error) {
    console.error("Deleting a site failed", error);
    return { ok: false, message: t.actions.deleteFailed };
  }
  if (!result.ok) {
    revalidatePath("/config", "layout");
    return { ok: false, message: t.actions.siteGone };
  }
  return applied("site-deleted");
}

async function applied(trigger: RevisionTrigger): Promise<SiteActionResult> {
  const apply = await applyAfterChange(trigger);
  revalidatePath("/config", "layout");
  return { ok: true, apply };
}

function noticeUrl(
  notice: "created" | "updated",
  hostname: string,
  outcome: ApplyOutcome,
): string {
  return `/config?${new URLSearchParams({ notice, site: hostname, apply: outcome.state })}`;
}
