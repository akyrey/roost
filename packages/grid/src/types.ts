import type { CellPos } from "./selection";

/** What the grid needs of a column; an app's columns add their own fields. */
export type GridColumnBase = {
  name: string;
  /** What the column links to; with `onFollow`, its cells get a link button. */
  references?: string;
};

export type SortKey = { column: string; descending: boolean };

export type CellKind =
  "null" | "empty" | "true" | "false" | "number" | "json" | "binary" | "array" | "text";

export type Presentation = {
  kind: CellKind;
  /** The preview shown in the cell. */
  text: string;
  /** The whole value is longer than the preview. */
  cut: boolean;
  alignRight: boolean;
};

export type HeaderBadge = { text: string; className: string };

/** How the grid reads an app's values and columns. Keep it stable (memoised): a new adapter
 * re-renders every cell. */
export type CellAdapter<V, C extends GridColumnBase> = {
  present: (value: V, column: C) => Presentation;
  /** Text that stands for the value when sizing columns. */
  widthText: (value: V) => string;
  /** The value as copied; `null` for no value (an empty field). */
  copyText: (value: V) => string | null;
  /** The header tooltip's second line and the badges before the name. */
  header: (column: C) => { detail: string; badges: readonly HeaderBadge[] };
};

export type EditorKind = "text" | "number" | "bool" | "temporal" | "long" | "binary" | "none";

export type Parsed<V> = { value: V } | { error: string };

export type RowMark<V> = {
  inserted: boolean;
  deleted: boolean;
  /** Columns with a pending value. */
  edited: string[];
  /** Values before the pending edits, shown on hover. */
  originals: Record<string, V>;
  /** The last apply failed on this row. */
  failed: boolean;
};

export type GridEditing<V> = {
  mark: (row: number) => RowMark<V>;
  /** How a cell is edited; `none` and `binary` cells are not edited inline. */
  kind: (cell: CellPos) => EditorKind;
  initialText: (cell: CellPos) => string;
  parse: (cell: CellPos, text: string) => Parsed<V>;
  hint: (cell: CellPos) => string | undefined;
  onCommit: (cell: CellPos, value: V) => void;
  /** Bool cells toggle without an editor. */
  onToggle: (cell: CellPos) => void;
  /** Long values are edited elsewhere (Dunlin: the cell viewer). */
  onEditLong: (cell: CellPos) => void;
  onSetNull: (cells: CellPos[]) => void;
  onDeleteRows: (rows: number[]) => void;
};
