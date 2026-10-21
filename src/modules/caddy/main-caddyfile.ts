import { code } from "@/i18n/codes";
import { type ParseResult, parsed, rejected } from "./parse-result";

/**
 * Characters allowed in paths that are written into Caddyfile text (the import
 * target and staging files): a single plain token, no quotes, braces, spaces.
 */
export const CADDYFILE_PATH_PATTERN = /^\/[A-Za-z0-9._/-]+$/;

const COMMENT = /^\s*#/;

/**
 * Returns the main Caddyfile text with the managed import pointed at another
 * file, for the request body of `/adapt` and `/load` only. The file on disk is
 * never changed.
 *
 * The import must appear exactly once, as its own line
 * `import <importPath>` (optionally quoted, optionally followed by a comment).
 * Anything else (missing, repeated, with arguments) is rejected, because the
 * validated config would then differ from what Caddy loads on a restart.
 */
export function redirectManagedImport(
  mainCaddyfile: string,
  importPath: string,
  targetPath: string,
): ParseResult<string> {
  return redirectImports(mainCaddyfile, [{ from: importPath, to: targetPath }]);
}

/** Like `redirectManagedImport` for several imports at once. */
export function redirectImports(
  mainCaddyfile: string,
  redirects: readonly { from: string; to: string }[],
): ParseResult<string> {
  const lines = mainCaddyfile.split("\n");
  for (const { from, to } of redirects) {
    if (
      !CADDYFILE_PATH_PATTERN.test(from) ||
      !CADDYFILE_PATH_PATTERN.test(to)
    ) {
      return rejected(code("main.invalidPath"));
    }
    const found = findImport(lines, from);
    if (found === null) {
      return rejected(code("main.importMissing", { path: from }));
    }
    const line = lines[found]!;
    const crlf = line.endsWith("\r") ? "\r" : "";
    lines[found] = line
      .replace(/\r$/, "")
      .replace(importLine(from), `$1${to}$3`)
      .concat(crlf);
  }
  return parsed(lines.join("\n"));
}

/** Whether the main Caddyfile imports `importPath` exactly once (and mentions it nowhere else). */
export function hasImport(mainCaddyfile: string, importPath: string): boolean {
  return findImport(mainCaddyfile.split("\n"), importPath) !== null;
}

/** Whether the Caddyfile defines the `(access_log)` snippet (see ARCHITECTURE.md 6.2). */
export function definesAccessLogSnippet(caddyfile: string): boolean {
  return /^[ \t]*\(access_log\)[ \t]*\{/m.test(caddyfile);
}

/** Generous for a hand-written Caddyfile, small enough for a form post. */
export const MAX_CADDYFILE_BYTES = 256 * 1024;

/** Normalizes line endings and the final newline; rejects what no Caddyfile contains. */
export function normalizeCaddyfile(input: unknown): ParseResult<string> {
  if (typeof input !== "string") return rejected(code("main.missing"));
  if (Buffer.byteLength(input, "utf8") > MAX_CADDYFILE_BYTES) {
    return rejected(code("main.tooLarge", { kib: MAX_CADDYFILE_BYTES / 1024 }));
  }
  if (input.includes("\0")) return rejected(code("main.nul"));
  return parsed(input.replace(/\r\n?/g, "\n").replace(/\n*$/, "\n"));
}

/**
 * Rules for an edited main Caddyfile: the managed import stays exactly once,
 * and the `admin` setting of the global options block stays as it is (the
 * manager reaches Caddy through it; a typo there would cut it off).
 */
export function validateMainEdit(
  current: string,
  next: string,
  sitesImportPath: string,
): ParseResult<void> {
  if (!hasImport(next, sitesImportPath)) {
    return rejected(code("main.sitesImportMissing", { path: sitesImportPath }));
  }
  if (adminSetting(current) !== adminSetting(next)) {
    return rejected(code("main.adminChanged"));
  }
  return parsed(undefined);
}

/**
 * The `admin` directive of the global options block (with its sub-block),
 * whitespace-normalized; "" if there is none.
 */
export function adminSetting(caddyfile: string): string {
  const lines = caddyfile.replace(/\r/g, "").split("\n");
  let index = lines.findIndex(
    (line) => line.trim() !== "" && !COMMENT.test(line),
  );
  if (index < 0 || !/^\{\s*(#.*)?$/.test(lines[index]!.trim())) return "";
  const found: string[] = [];
  let depth = 1;
  let inAdmin = false;
  let adminDepth = 0;
  for (index++; index < lines.length && depth > 0; index++) {
    const line = lines[index]!.trim();
    if (line === "" || line.startsWith("#")) continue;
    if (depth === 1 && /^admin(\s|$|\{)/.test(line)) {
      inAdmin = true;
      adminDepth = depth;
    }
    if (inAdmin) found.push(line.replace(/\s+/g, " "));
    depth += braces(line);
    if (inAdmin && depth <= adminDepth) inAdmin = false;
  }
  return found.join("\n");
}

/** Net brace count of a line, ignoring quoted text and comments. */
function braces(line: string): number {
  let count = 0;
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === "\\") i++;
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === "#" && (i === 0 || /\s/.test(line[i - 1]!)))
      break;
    else if (!quoted && char === "{") count++;
    else if (!quoted && char === "}") count--;
  }
  return count;
}

function importLine(importPath: string): RegExp {
  return new RegExp(
    `^(\\s*import\\s+)("?)${escapeRegExp(importPath)}\\2(\\s*(?:#.*)?)$`,
  );
}

function findImport(
  lines: readonly string[],
  importPath: string,
): number | null {
  const pattern = importLine(importPath);
  const matches: number[] = [];
  let mentions = 0;
  lines.forEach((line, index) => {
    if (COMMENT.test(line)) return;
    if (line.includes(importPath)) mentions++;
    if (pattern.test(line.replace(/\r$/, ""))) matches.push(index);
  });
  return matches.length === 1 && mentions === 1 ? matches[0]! : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
