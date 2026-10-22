/**
 * The site blocks of a hand-written Caddyfile, and adding `import access_log`
 * to them. A small lexer follows Caddy's rules (quotes, backticks, heredocs,
 * comments, braces as separate tokens), so text inside strings or comments is
 * never taken for a block.
 */

export interface CaddyfileSite {
  /** Position among the site blocks, used to select them. */
  index: number;
  addresses: string[];
  /** 1-based line of the opening brace. */
  line: number;
  /** Imports the `access_log` snippet directly in the block. */
  accessLog: boolean;
  /** The opening brace ends its line, so a line can be inserted after it. */
  editable: boolean;
  /** `(access_log)` is defined above: Caddy only imports snippets defined earlier. */
  snippetAbove: boolean;
}

interface Token {
  text: string;
  line: number;
  /** Offset just after the token. */
  end: number;
  /** First token of its line. */
  lineStart: boolean;
}

interface Block extends CaddyfileSite {
  /** Start of the line after the opening brace. */
  insertAt: number;
  /** The import line, indented like the block's first directive. */
  insertion: string;
}

export function listCaddyfileSites(caddyfile: string): CaddyfileSite[] {
  return siteBlocks(caddyfile).map(
    ({ index, addresses, line, accessLog, editable, snippetAbove }) => ({
      index,
      addresses,
      line,
      accessLog,
      editable,
      snippetAbove,
    }),
  );
}

/**
 * Adds `import access_log` as the first line of the selected site blocks that
 * do not import it yet. Blocks that cannot take a line (`site { … }` on one
 * line) or come before the snippet's definition are skipped. Returns the text
 * unchanged if there is nothing to add.
 */
export function addAccessLogImports(
  caddyfile: string,
  indices: readonly number[],
): string {
  const selected = new Set(indices);
  const blocks = siteBlocks(caddyfile)
    .filter((block) => selected.has(block.index))
    .filter((block) => canAdd(block))
    .sort((a, b) => b.insertAt - a.insertAt);
  let text = caddyfile;
  for (const block of blocks) {
    text =
      text.slice(0, block.insertAt) +
      block.insertion +
      text.slice(block.insertAt);
  }
  return text;
}

/** Whether `addAccessLogImports` would add the line to this site. */
export function canAdd(site: CaddyfileSite): boolean {
  return site.editable && site.snippetAbove && !site.accessLog;
}

function siteBlocks(caddyfile: string): Block[] {
  const tokens = tokenize(caddyfile);
  const blocks: Block[] = [];
  let header: Token[] = [];
  let depth = 0;
  let current: Block | null = null;
  let previousLine = 0;
  let snippetSeen = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (depth === 0 && token.line !== previousLine && header.length > 0) {
      // A header only continues on the next line after a trailing comma.
      if (!header.at(-1)!.text.endsWith(",")) header = [];
    }
    previousLine = token.line;

    if (token.text === "{") {
      if (depth === 0) {
        current = siteBlock(caddyfile, header, token, tokens[i + 1]);
        if (current) {
          current.index = blocks.length;
          current.snippetAbove = snippetSeen;
          blocks.push(current);
        }
        if (header.length === 1 && header[0]!.text === "(access_log)") {
          snippetSeen = true;
        }
        header = [];
      }
      depth++;
      continue;
    }
    if (token.text === "}") {
      depth = Math.max(0, depth - 1);
      if (depth === 0) current = null;
      continue;
    }
    if (depth === 0) {
      header.push(token);
    } else if (
      depth === 1 &&
      current &&
      token.lineStart &&
      token.text === "import" &&
      tokens[i + 1]?.text === "access_log" &&
      tokens[i + 1]!.line === token.line
    ) {
      current.accessLog = true;
    }
  }
  return blocks;
}

function siteBlock(
  caddyfile: string,
  header: Token[],
  brace: Token,
  next: Token | undefined,
): Block | null {
  // The global options block, snippets and named routes are no sites.
  if (header.length === 0) return null;
  const first = header[0]!.text;
  if (/^\(.*\)$/.test(first) || first.startsWith("&(")) return null;

  const lineEnd = caddyfile.indexOf("\n", brace.end);
  const rest = caddyfile.slice(brace.end, lineEnd < 0 ? undefined : lineEnd);
  const editable = /^[ \t]*(#.*)?\r?$/.test(rest);
  const eol = rest.endsWith("\r") ? "\r\n" : "\n";
  const headerIndent = indentationAt(caddyfile, header[0]!);
  const inner =
    next && next.text !== "}" && next.line > brace.line
      ? indentationAt(caddyfile, next)
      : "";
  const indent =
    inner.length > headerIndent.length ? inner : `${headerIndent}\t`;
  return {
    index: 0,
    addresses: header
      .flatMap((token) => token.text.split(","))
      .filter((address) => address !== ""),
    line: brace.line,
    accessLog: false,
    editable,
    snippetAbove: false,
    insertAt: lineEnd < 0 ? caddyfile.length : lineEnd + 1,
    insertion:
      lineEnd < 0
        ? `${eol}${indent}import access_log`
        : `${indent}import access_log${eol}`,
  };
}

function indentationAt(text: string, token: Token): string {
  const start = text.lastIndexOf("\n", token.end - token.text.length - 1) + 1;
  return /^[ \t]*/.exec(text.slice(start))![0];
}

/** Caddyfile tokens with their line; quoted tokens keep their quotes. */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let line = 1;
  let lastLine = 0;
  let i = 0;
  const push = (value: string, startLine: number) => {
    tokens.push({
      text: value,
      line: startLine,
      end: i,
      lineStart: startLine !== lastLine,
    });
    lastLine = startLine;
  };

  while (i < text.length) {
    const char = text[i]!;
    if (char === "\n") {
      line++;
      i++;
      continue;
    }
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if (char === "#") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    const startLine = line;
    if (char === '"' || char === "`") {
      const start = i++;
      while (i < text.length && text[i] !== char) {
        if (char === '"' && text[i] === "\\") i++;
        if (text[i] === "\n") line++;
        i++;
      }
      i++;
      push(text.slice(start, i), startLine);
      continue;
    }
    const heredoc = /^<<([A-Za-z0-9_-]+)[ \t]*\r?\n/.exec(text.slice(i));
    if (heredoc) {
      const start = i;
      const marker = heredoc[1]!;
      i += heredoc[0].length;
      line++;
      for (;;) {
        const end = text.indexOf("\n", i);
        const content = text.slice(i, end < 0 ? text.length : end);
        i = end < 0 ? text.length : end + 1;
        if (end >= 0) line++;
        if (content.trim() === marker || end < 0) break;
      }
      push(text.slice(start, i), startLine);
      continue;
    }
    const start = i;
    while (i < text.length && !/\s/.test(text[i]!)) i++;
    push(text.slice(start, i), startLine);
  }
  return tokens;
}
