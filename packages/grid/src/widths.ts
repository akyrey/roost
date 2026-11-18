/** Column widths from content: estimated from character counts, no DOM measuring. */

export const MIN_WIDTH = 56;
export const MAX_AUTO_WIDTH = 480;
/** Monospace 12px plus a little. */
const CHAR_WIDTH = 7.2;
const PADDING = 20;
/** Rows looked at for the initial widths; auto-size on request looks at every row. */
const SAMPLE_ROWS = 50;

export function widthFor(texts: string[]): number {
  const longest = texts.reduce((max, text) => Math.max(max, text.length), 0);
  return Math.round(Math.max(MIN_WIDTH, Math.min(MAX_AUTO_WIDTH, longest * CHAR_WIDTH + PADDING)));
}

export function columnWidth<V>(
  header: string,
  rows: readonly (readonly V[])[],
  index: number,
  textOf: (value: V) => string,
  sampleAll = false,
): number {
  const sample = sampleAll ? rows : rows.slice(0, SAMPLE_ROWS);
  // The header has room for its badges and sort arrow too.
  const texts = [
    `${header}    `,
    ...sample.map((row) => {
      const value = row[index];
      return value === undefined ? "" : textOf(value);
    }),
  ];
  return widthFor(texts);
}
