export type DiffLine =
  | { kind: "same" | "added" | "removed"; text: string }
  | { kind: "skipped"; count: number };

/** Upper bound of the LCS table (lines before × lines after). */
const MAX_CELLS = 4_000_000;

/**
 * Line diff via longest common subsequence, with unchanged runs shortened to
 * `context` lines around each change. `null` if the texts are too large.
 */
export function lineDiff(
  before: string,
  after: string,
  context = 3,
): DiffLine[] | null {
  const a = splitLines(before);
  const b = splitLines(after);
  // Common prefix and suffix need no table.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const n = endA - start;
  const m = endB - start;
  if ((n + 1) * (m + 1) > MAX_CELLS) return null;

  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[start + i] === b[start + j]
          ? table[(i + 1) * width + j + 1]! + 1
          : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
    }
  }

  const lines: DiffLine[] = a
    .slice(0, start)
    .map((text) => ({ kind: "same", text }));
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[start + i] === b[start + j]) {
      lines.push({ kind: "same", text: a[start + i]! });
      i++;
      j++;
    } else if (
      i < n &&
      (j === m || table[(i + 1) * width + j]! >= table[i * width + j + 1]!)
    ) {
      lines.push({ kind: "removed", text: a[start + i]! });
      i++;
    } else {
      lines.push({ kind: "added", text: b[start + j]! });
      j++;
    }
  }
  for (const text of a.slice(endA)) lines.push({ kind: "same", text });
  return collapse(lines, context);
}

function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.replace(/\n$/, "").split("\n");
}

function collapse(lines: DiffLine[], context: number): DiffLine[] {
  const changed = lines.map((line) => line.kind !== "same");
  const keep = lines.map((_, index) => {
    for (
      let k = Math.max(0, index - context);
      k <= Math.min(lines.length - 1, index + context);
      k++
    ) {
      if (changed[k]) return true;
    }
    return false;
  });
  const result: DiffLine[] = [];
  let skipped = 0;
  lines.forEach((line, index) => {
    if (keep[index]) {
      if (skipped > 0) result.push({ kind: "skipped", count: skipped });
      skipped = 0;
      result.push(line);
    } else {
      skipped++;
    }
  });
  if (skipped > 0) result.push({ kind: "skipped", count: skipped });
  return result;
}
