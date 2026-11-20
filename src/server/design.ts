import { cookies } from "next/headers";

import { type Design, DESIGN_COOKIE, resolveDesign } from "@/design";

/** Design of the current request, from its cookie (Server Components). */
export async function getDesign(): Promise<Design> {
  return resolveDesign((await cookies()).get(DESIGN_COOKIE)?.value);
}
