/** How well `query` matches `text`: lower is better, `null` when it does not match. Words of the
 * query must each appear, in order, as a prefix of a word or anywhere in the text. */
export function matchScore(query: string, text: string): number | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;
  const haystack = text.toLowerCase();
  if (haystack.startsWith(needle)) return 0;
  const at = haystack.indexOf(needle);
  if (at >= 0) return /\W/.test(haystack.charAt(at - 1)) ? 1 : 2;
  // Each character in order (`nt` finds "New tab").
  let from = 0;
  for (const char of needle) {
    if (char === " ") continue;
    const found = haystack.indexOf(char, from);
    if (found < 0) return null;
    from = found + 1;
  }
  return 3;
}

/** The items matching `query`, best first, keeping the given order among equals. */
export function filterByQuery<T>(
  items: readonly T[],
  query: string,
  text: (item: T) => string,
): T[] {
  return items
    .map((item, index) => ({ item, index, score: matchScore(query, text(item)) }))
    .filter((r): r is { item: T; index: number; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((r) => r.item);
}
