import type { CellKind } from "./types";

/** Characters of a long value shown in a cell. */
const PREVIEW_CHARS = 200;

/** The first line of `text`, at most 200 characters; `cut` when that is not all of it (or
 * `truncated` says the text itself is incomplete). */
export function preview(text: string, truncated: boolean): { text: string; cut: boolean } {
  const newline = text.search(/[\r\n]/);
  const firstLine = newline >= 0 ? text.slice(0, newline) : text;
  const short = firstLine.length > PREVIEW_CHARS ? firstLine.slice(0, PREVIEW_CHARS) : firstLine;
  const cut = truncated || short.length < text.length;
  return { text: cut ? `${short}…` : short, cut };
}

export const KIND_CLASS: Record<CellKind, string> = {
  null: "italic text-zinc-500",
  empty: "",
  true: "text-emerald-400",
  false: "text-rose-400",
  number: "tabular-nums text-sky-200",
  json: "text-amber-200",
  binary: "italic text-violet-300",
  array: "text-teal-200",
  text: "text-zinc-100",
};
