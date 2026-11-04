"use server";

import { revalidatePath } from "next/cache";

import { code } from "@/i18n/codes";
import { requireAccess } from "@/server/auth/session";

import { runCertificateCheck } from "./checks";

export interface CheckCertificatesResult {
  ok: boolean;
  /** Message code. */
  message: string;
}

/**
 * “Check now”: checks every host name of the running configuration. Takes no
 * input on purpose; the targets come from Caddy's configuration only.
 */
export async function checkCertificatesAction(): Promise<CheckCertificatesResult> {
  await requireAccess();
  const result = await runCertificateCheck("manual");
  revalidatePath("/certificates");
  revalidatePath("/dashboard");
  switch (result.state) {
    case "done":
      return { ok: true, message: code("cert.runDone", { n: result.checked }) };
    case "recent":
      return { ok: true, message: code("cert.runRecent") };
    case "not-configured":
      return { ok: false, message: code("apply.notConfigured") };
    case "unreachable":
      return { ok: false, message: result.message };
  }
}
