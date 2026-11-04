/**
 * Minimal structural model of a Caddyfile and its renderer.
 *
 * The renderer never concatenates free text: a document consists of site
 * blocks, a site block of directives, and every address, directive name and
 * argument is a single `CaddyToken`. A token may only contain characters that
 * the Caddyfile lexer treats as part of one plain word, so a value can never
 * end a line, open or close a block, start a comment, a quoted string, a
 * heredoc, a matcher or a `{placeholder}`. Exceptions: placeholders from a
 * fixed list in URLs and free text, and free text as a quoted string with
 * escaped quotes (`caddyText`, for arguments after the first). This holds even
 * for values that bypassed domain validation: the renderer re-checks every token.
 */

declare const caddyTokenBrand: unique symbol;

/** A string that is safe to emit as exactly one bare Caddyfile token. */
export type CaddyToken = string & { readonly [caddyTokenBrand]: true };

export interface CaddyDirective {
  name: CaddyToken;
  args: readonly CaddyToken[];
  /** Optional sub-directives (`name args { … }`). */
  block?: readonly CaddyDirective[];
}

export interface CaddySiteBlock {
  addresses: readonly CaddyToken[];
  directives: readonly CaddyDirective[];
}

export interface CaddyfileDocument {
  /** Comment lines written at the top, without the leading `#`. */
  header?: readonly string[];
  sites: readonly CaddySiteBlock[];
}

export class CaddyfileError extends Error {
  override name = "CaddyfileError";
}

/**
 * Starts with a letter or digit (never `{`, `@`, `#`, `"`, `<` …) and only
 * contains characters needed for site addresses, directive names and
 * upstream URLs: no whitespace, quotes, braces, `#`, `$`, `\`, `*`, `@`.
 */
const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/[\]-]*$/;
/**
 * A bcrypt hash (`$2b$12$…`, only `$./` besides letters and digits). A bare
 * `$` has no meaning to the lexer: environment variables need `{$NAME}`.
 */
const BCRYPT_TOKEN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
/** Printable ASCII, no line breaks; `{` and `}` are excluded as well. */
const SAFE_COMMENT = /^[\x20-\x7a|~]*$/;

/** Placeholders allowed in a URL token, e.g. `https://new.example.com{uri}`. */
export const URL_PLACEHOLDERS = [
  "uri",
  "path",
  "query",
  "host",
  "hostport",
  "scheme",
] as const;
const URL_CHARS = "A-Za-z0-9\\-._~:/?\\[\\]@!$&'()*+,;=%";
/**
 * An absolute http(s) URL of URL characters and known placeholders only: no
 * whitespace, quotes, `#`, `\` or other braces. A `{` is only ever followed by
 * a placeholder name, so `{$ENV}` substitution cannot happen.
 */
const URL_TOKEN = new RegExp(
  `^https?://[${URL_CHARS}]*(?:\\{(?:${URL_PLACEHOLDERS.join("|")})\\}[${URL_CHARS}]*)*$`,
);

/**
 * Request placeholders allowed in free text (header values), as Caddyfile
 * shorthands. Deliberately no `{env.*}`, `{file.*}` or `{$VAR}`: those would
 * read the server's environment or files.
 */
export const TEXT_PLACEHOLDERS = [
  "host",
  "hostport",
  "port",
  "scheme",
  "uri",
  "path",
  "query",
  "method",
  "remote",
  "remote_host",
  "remote_port",
  "client_ip",
  "tls_version",
  "tls_cipher",
  "upstream_hostport",
] as const;
const PLACEHOLDER = `\\{(?:${TEXT_PLACEHOLDERS.join("|")}|header\\.[A-Za-z0-9-]+)\\}`;
/** Printable ASCII without `"`, `\`, `{` and `}`. */
const TEXT_CHAR = "[\\x20\\x21\\x23-\\x5b\\x5d-\\x7a\\x7c\\x7e]";
/**
 * Free text for a quoted string: printable ASCII, braces only as an allowed
 * placeholder, `"` anywhere (escaped when quoted), and `\` only before a
 * character other than `"` (the lexer keeps such a backslash; before a quote
 * or at the end it would escape the quote instead).
 */
const TEXT = new RegExp(`^(?:${TEXT_CHAR}|"|${PLACEHOLDER}|\\\\(?=[^"]))*$`);
/**
 * Text that needs no quotes: placeholders and plain word characters, starting
 * with a letter, digit or placeholder (never `/`, `-` or `@`).
 */
const BARE_TEXT = new RegExp(
  `^(?:${PLACEHOLDER}|[A-Za-z0-9])(?:${PLACEHOLDER}|[A-Za-z0-9._:/-])*$`,
);

export function isUrlToken(value: string): boolean {
  return URL_TOKEN.test(value);
}

/** Whether `caddyText` can emit this value. */
export function isCaddyText(value: string): boolean {
  return value !== "" && TEXT.test(value);
}

function quoted(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
}

/** A rendered quoted string whose content is allowed text, quoted canonically. */
function isQuotedToken(value: string): boolean {
  if (value.length < 2 || !value.startsWith('"') || !value.endsWith('"')) {
    return false;
  }
  const content = value.slice(1, -1).replaceAll('\\"', '"');
  return isCaddyText(content) && quoted(content) === value;
}

export function isCaddyToken(value: string): value is CaddyToken {
  return (
    SAFE_TOKEN.test(value) || BCRYPT_TOKEN.test(value) || URL_TOKEN.test(value)
  );
}

/**
 * Free text (e.g. a header value with spaces) as one token: bare when that is
 * unambiguous, otherwise as a quoted string.
 */
export function caddyText(value: string): CaddyToken {
  if (!isCaddyText(value)) {
    throw new CaddyfileError("Unsafe Caddyfile text");
  }
  return (BARE_TEXT.test(value) ? value : quoted(value)) as CaddyToken;
}

export function caddyToken(value: string): CaddyToken {
  if (!isCaddyToken(value)) {
    throw new CaddyfileError(
      `Unsafe Caddyfile token: ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/** Formatting follows `caddy fmt`: tab indentation, one blank line between sites. */
export function renderCaddyfile(document: CaddyfileDocument): string {
  const sections: string[] = [];

  if (document.header?.length) {
    sections.push(document.header.map(renderComment).join("\n"));
  }
  for (const site of document.sites) {
    sections.push(renderSiteBlock(site));
  }

  return sections.length === 0 ? "" : `${sections.join("\n\n")}\n`;
}

function renderComment(line: string): string {
  if (!SAFE_COMMENT.test(line)) {
    throw new CaddyfileError("Unsafe Caddyfile comment");
  }
  return line === "" ? "#" : `# ${line}`;
}

function renderSiteBlock(site: CaddySiteBlock): string {
  if (site.addresses.length === 0) {
    throw new CaddyfileError("A site block needs at least one address");
  }
  const head = site.addresses.map(checked).join(", ");
  const body = site.directives.flatMap((directive) =>
    renderDirective(directive, 1),
  );
  return [`${head} {`, ...body, "}"].join("\n");
}

function renderDirective(directive: CaddyDirective, depth: number): string[] {
  const indent = "\t".repeat(depth);
  const line = [directive.name, ...directive.args].map(checked).join(" ");
  if (!directive.block) return [`${indent}${line}`];
  return [
    `${indent}${line} {`,
    ...directive.block.flatMap((child) => renderDirective(child, depth + 1)),
    `${indent}}`,
  ];
}

/** Branded types only exist at compile time, so every token is re-checked. */
function checked(token: CaddyToken): string {
  if (BARE_TEXT.test(token) || isQuotedToken(token)) return token;
  return caddyToken(token);
}
