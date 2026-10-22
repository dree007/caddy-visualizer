"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { code } from "@/i18n/codes";
import { getI18n } from "@/i18n/server";
import { sha256Of } from "@/lib/sha256";
import {
  addAccessLogImports,
  listCaddyfileSites,
} from "@/modules/caddy/caddyfile-sites";
import { definesAccessLogSnippet } from "@/modules/caddy/main-caddyfile";
import { requireSession } from "@/server/auth/session";

import { applyCaddyfile } from "./apply";
import { readMainCaddyfile } from "./engine";
import type { SiteActionResult } from "./site-form";

const selection = z.union([
  z.literal("all"),
  z.array(z.number().int().nonnegative()).min(1).max(1000),
]);

/**
 * Adds `import access_log` to the selected site blocks of the main Caddyfile
 * (or to all of them). Goes through the normal Caddyfile apply: checked by
 * Caddy, recorded as a revision, written only after Caddy took it.
 * `baseSha256` is the file the selection was made on.
 */
export async function enableAccessLogAction(
  sites: unknown,
  baseSha256: unknown,
): Promise<SiteActionResult> {
  await requireSession();
  const { t } = await getI18n();
  const parsed = selection.safeParse(sites);
  if (!parsed.success) return { ok: false, message: t.actions.changeFailed };

  let file: string;
  try {
    file = await readMainCaddyfile();
  } catch {
    return { ok: false, message: code("apply.mainUnreadable") };
  }
  if (sha256Of(file) !== baseSha256) {
    return { ok: false, message: code("apply.mainConflict") };
  }
  if (!definesAccessLogSnippet(file)) {
    return { ok: false, message: code("accessLog.snippetMissing") };
  }
  const indices =
    parsed.data === "all"
      ? listCaddyfileSites(file).map((site) => site.index)
      : parsed.data;
  const next = addAccessLogImports(file, indices);
  if (next === file) {
    return { ok: false, message: code("accessLog.nothingToAdd") };
  }

  const apply = await applyCaddyfile(next, baseSha256);
  revalidatePath("/config", "layout");
  return { ok: true, apply };
}
