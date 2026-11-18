import type { RowMark } from "./types";

export type RowState = "normal" | "inserted" | "deleted" | "failed";

export function rowState<V>(mark: RowMark<V> | undefined): RowState {
  if (!mark) return "normal";
  if (mark.failed) return "failed";
  if (mark.deleted) return "deleted";
  return mark.inserted ? "inserted" : "normal";
}

export const ROW_CLASS: Record<RowState, string> = {
  normal: "",
  inserted: "bg-emerald-950/60",
  deleted: "bg-rose-950/60 line-through opacity-70",
  failed: "bg-rose-900/60 ring-1 ring-inset ring-rose-500",
};
