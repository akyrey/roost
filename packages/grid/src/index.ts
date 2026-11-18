// @roost/grid: a row- and column-virtualised grid with selection, keyboard navigation,
// resizing, copy and optional inline editing, generic over the app's values and columns.
export { DataGrid } from "./DataGrid";
export { toTsv } from "./copy";
export { GRID_KEYS, type GridShortcutId } from "./keys";
export { KIND_CLASS, preview } from "./present";
export {
  type Bounds,
  type CellPos,
  type GridSelection,
  type Range,
  isSelected,
  navigate,
  rangeOf,
  select,
  selectAll,
  selectRow,
} from "./selection";
export type {
  CellAdapter,
  CellKind,
  EditorKind,
  GridColumnBase,
  GridEditing,
  HeaderBadge,
  Parsed,
  Presentation,
  RowMark,
  SortKey,
} from "./types";
export { MAX_AUTO_WIDTH, MIN_WIDTH, columnWidth, widthFor } from "./widths";
