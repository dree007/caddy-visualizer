import type { Messages } from "./messages/en";

/*
 * Messages that cross layers (domain modules, stored revisions, Server
 * Actions) travel as codes and are translated where they are shown. A text
 * that is not a known code (an older stored message, Caddy's own error text)
 * is shown as it is.
 */

export type CodeKey = keyof Messages["codes"];
export type CodeParams = Record<string, string | number>;

const SEPARATOR = "|";

export function code(key: CodeKey, params?: CodeParams): string {
  return params ? `${key}${SEPARATOR}${JSON.stringify(params)}` : key;
}

export function translateCode(messages: Messages, value: string): string {
  const cut = value.indexOf(SEPARATOR);
  const key = (cut < 0 ? value : value.slice(0, cut)) as CodeKey;
  const entry = messages.codes[key] as
    string | ((params: CodeParams) => string) | undefined;
  if (entry === undefined) return value;
  if (typeof entry === "string") return entry;
  let params: CodeParams = {};
  try {
    params = cut < 0 ? {} : (JSON.parse(value.slice(cut + 1)) as CodeParams);
  } catch {
    return value;
  }
  return entry(params);
}
