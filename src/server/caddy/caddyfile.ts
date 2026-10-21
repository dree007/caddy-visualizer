import "server-only";

import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";

import { sha256Of } from "@/lib/sha256";
import { requireSession } from "@/server/auth/session";
import { getEnv } from "@/server/env";

import { readMainCaddyfile } from "./engine";

export type CaddyfileEditorStatus =
  | { state: "not-configured" }
  | { state: "unreadable"; path: string }
  | {
      state: "ok";
      content: string;
      sha256: string;
      /** UID 1000 may write it; otherwise saving fails. */
      writable: boolean;
      /**
       * Replaced on the host (new inode) after the container started: this
       * mount and Caddy's still show the old file.
       */
      replaced: boolean;
    };

export async function loadCaddyfileEditorStatus(): Promise<CaddyfileEditorStatus> {
  await requireSession();
  const env = getEnv();
  if (!env.CADDY_ADMIN_URL) return { state: "not-configured" };
  const path = env.CADDY_MAIN_CADDYFILE;
  let content: string;
  try {
    content = await readMainCaddyfile();
  } catch {
    return { state: "unreadable", path };
  }
  const writable = await access(path, constants.W_OK).then(
    () => true,
    () => false,
  );
  const replaced = await stat(path).then(
    (info) => info.nlink === 0,
    () => false,
  );
  return {
    state: "ok",
    content,
    sha256: sha256Of(content),
    writable,
    replaced,
  };
}
