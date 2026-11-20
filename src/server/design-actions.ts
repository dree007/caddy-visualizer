"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { DESIGN_COOKIE, isDesign } from "@/design";
import { secureCookiesEnabled } from "@/server/auth/cookie";

/** Stores the chosen design; works with and without a session (login page). */
export async function setDesignAction(design: unknown): Promise<void> {
  if (!isDesign(design)) return;
  (await cookies()).set(DESIGN_COOKIE, design, {
    path: "/",
    maxAge: 365 * 24 * 3600,
    sameSite: "lax",
    httpOnly: true,
    secure: secureCookiesEnabled(),
  });
  revalidatePath("/", "layout");
}
