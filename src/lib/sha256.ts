import { createHash } from "node:crypto";

export function sha256Of(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
