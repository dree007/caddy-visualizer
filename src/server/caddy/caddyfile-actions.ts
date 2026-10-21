"use server";

import { revalidatePath } from "next/cache";

import { code } from "@/i18n/codes";
import { getI18n } from "@/i18n/server";
import { lineDiff } from "@/lib/line-diff";
import { sha256Of } from "@/lib/sha256";
import { normalizeCaddyfile } from "@/modules/caddy/main-caddyfile";
import { requireSession } from "@/server/auth/session";

import { applyCaddyfile, checkCaddyfile } from "./apply";
import type { CaddyfileEditorState } from "./caddyfile-form";
import { readMainCaddyfile } from "./engine";

/*
 * Server Action of the Caddyfile editor. Saving runs the same dry run as
 * "Check" first (it reports Caddy's own message with line numbers); the
 * apply engine then checks the version again and writes the file only after
 * Caddy accepted it.
 */

export async function caddyfileEditorAction(
  previous: CaddyfileEditorState,
  formData: FormData,
): Promise<CaddyfileEditorState> {
  await requireSession();
  const attempt = previous.attempt + 1;
  const raw = formData.get("content");
  const echo = typeof raw === "string" ? raw : "";
  const baseSha256 = String(formData.get("baseSha256") ?? "");

  let file: string;
  try {
    file = await readMainCaddyfile();
  } catch {
    return {
      ...previous,
      content: echo,
      attempt,
      result: error(code("apply.mainUnreadable")),
    };
  }
  const state = (
    result: CaddyfileEditorState["result"],
  ): CaddyfileEditorState => ({
    content: echo,
    fileContent: file,
    baseSha256,
    result,
    attempt,
  });

  const valid = normalizeCaddyfile(raw);
  if (!valid.ok) return state(error(valid.message));
  const content = valid.value;
  if (sha256Of(file) !== baseSha256)
    return state(error(code("apply.mainConflict")));

  const check = await checkCaddyfile(content);
  if (!check.ok) return state(error(check.message));

  if (formData.get("intent") !== "save") {
    return state({
      kind: "checked",
      warnings: check.warnings,
      diff: lineDiff(file, content),
      unchanged: content === file,
    });
  }
  if (content === file)
    return state(error((await getI18n()).t.caddyfile.nothingToSave));

  const outcome = await applyCaddyfile(content, baseSha256);
  revalidatePath("/config", "layout");
  const after = await readMainCaddyfile().catch(() => file);
  return {
    content: outcome.state === "applied" ? content : echo,
    fileContent: after,
    baseSha256: sha256Of(after),
    result: { kind: "saved", outcome, warnings: check.warnings },
    attempt,
  };
}

function error(message: string) {
  return { kind: "error", message } as const;
}
