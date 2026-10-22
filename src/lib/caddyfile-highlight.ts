/**
 * Syntax highlighting for Caddyfiles: splits the text into lines of typed
 * segments. Every character of the input is kept exactly once, in order, so
 * the result can be laid over a textarea character by character.
 */

export type CaddyfileTokenKind =
  | "plain"
  | "comment"
  | "string"
  | "brace"
  | "placeholder"
  | "address"
  | "directive"
  | "matcher"
  | "snippet";

export interface CaddyfileSegment {
  text: string;
  kind: CaddyfileTokenKind;
}

/** A word that is part of a site address list or a snippet/route name. */
const SNIPPET = /^&?\(.*\)$/;

export function highlightCaddyfile(text: string): CaddyfileSegment[][] {
  const lines: CaddyfileSegment[][] = [];
  let depth = 0;
  let quote: '"' | "`" | null = null;
  let heredoc: string | null = null;

  for (const line of text.split("\n")) {
    const segments: CaddyfileSegment[] = [];
    const push = (value: string, kind: CaddyfileTokenKind) => {
      if (value === "") return;
      const last = segments.at(-1);
      if (last && last.kind === kind) last.text += value;
      else segments.push({ text: value, kind });
    };

    let i = 0;
    let first = true;
    if (heredoc !== null) {
      // The closing marker may be followed by more arguments (`HTML 200`).
      const end = new RegExp(`^\\s*${heredoc}(?=\\s|$)`).exec(line);
      if (!end) {
        push(line, "string");
        lines.push(segments);
        continue;
      }
      push(end[0], "string");
      heredoc = null;
      i = end[0].length;
      first = false;
    }

    // At depth 0 a line is a block header if it opens a block or continues an address list.
    const header = depth === 0 && quote === null && opensHeader(line);
    while (i < line.length) {
      const char = line[i]!;
      if (quote !== null) {
        const end = closingQuote(line, i, quote);
        push(line.slice(i, end), "string");
        if (end <= line.length && line[end - 1] === quote && end > i) {
          quote = null;
        }
        i = end;
        first = false;
        continue;
      }
      if (char === " " || char === "\t" || char === "\r") {
        const start = i;
        while (i < line.length && /[ \t\r]/.test(line[i]!)) i++;
        push(line.slice(start, i), "plain");
        continue;
      }
      if (char === "#") {
        push(line.slice(i), "comment");
        break;
      }
      if (char === '"' || char === "`") {
        quote = char;
        const end = closingQuote(line, i + 1, char);
        push(line.slice(i, end), "string");
        if (line[end - 1] === char && end - 1 > i) quote = null;
        i = end;
        first = false;
        continue;
      }
      const heredocStart = /^<<([A-Za-z0-9_-]+)\s*$/.exec(line.slice(i));
      if (heredocStart) {
        push(line.slice(i), "string");
        heredoc = heredocStart[1]!;
        break;
      }

      const start = i;
      while (i < line.length && !/[ \t\r]/.test(line[i]!)) i++;
      const word = line.slice(start, i);
      if (word === "{" || word === "}") {
        push(word, "brace");
        depth = Math.max(0, depth + (word === "{" ? 1 : -1));
      } else if (header) {
        pushWord(push, word, SNIPPET.test(word) ? "snippet" : "address");
      } else if (word.startsWith("@")) {
        pushWord(push, word, "matcher");
      } else if (first) {
        pushWord(push, word, "directive");
      } else {
        pushWord(push, word, "plain");
      }
      first = false;
    }
    lines.push(segments);
  }
  return lines;
}

/** A word with its `{placeholders}` (e.g. `{uri}`, `{$ENV}`) marked. */
function pushWord(
  push: (value: string, kind: CaddyfileTokenKind) => void,
  word: string,
  kind: CaddyfileTokenKind,
) {
  let rest = word;
  for (;;) {
    const match = /\{[^{}\s]+\}/.exec(rest);
    if (!match) break;
    push(rest.slice(0, match.index), kind);
    push(match[0], "placeholder");
    rest = rest.slice(match.index + match[0].length);
  }
  push(rest, kind);
}

/** Index just after the closing quote, or the line's end if it continues. */
function closingQuote(line: string, from: number, quote: '"' | "`"): number {
  for (let i = from; i < line.length; i++) {
    if (quote === '"' && line[i] === "\\") {
      i++;
      continue;
    }
    if (line[i] === quote) return i + 1;
  }
  return line.length;
}

function opensHeader(line: string): boolean {
  const code = line.replace(/(^|\s)#.*$/, "").trimEnd();
  return /(^|\s)\{$/.test(code) || (code.endsWith(",") && code !== ",");
}
