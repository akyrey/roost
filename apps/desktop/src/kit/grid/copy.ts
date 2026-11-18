/** Copying a selected range as tab-separated values. */
import type { Range } from "./selection";

/** A field needs quoting when it holds a tab, a line break or a quote (spreadsheet rules). */
function field(text: string | null): string {
  if (text === null) return "";
  return /[\t\n\r"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toTsv<V>(
  rows: readonly (readonly V[])[],
  range: Range,
  copyText: (value: V) => string | null,
  header?: string[],
): string {
  const lines: string[] = [];
  if (header) lines.push(header.slice(range.left, range.right + 1).join("\t"));
  for (let row = range.top; row <= range.bottom; row++) {
    const cells = rows[row] ?? [];
    const line: string[] = [];
    for (let col = range.left; col <= range.right; col++) {
      const value = cells[col];
      line.push(field(value === undefined ? null : copyText(value)));
    }
    lines.push(line.join("\t"));
  }
  return lines.join("\n");
}
