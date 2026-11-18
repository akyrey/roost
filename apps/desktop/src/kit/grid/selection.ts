/** Cell and range selection in the grid, and how keys move it (task 6.5). Pure. */
export type CellPos = { row: number; col: number };

/** `anchor` is where the selection started; `focus` moves with the keyboard or the mouse. */
export type GridSelection = { anchor: CellPos; focus: CellPos } | null;

export type Bounds = { rows: number; cols: number; pageRows: number };

export type Range = { top: number; bottom: number; left: number; right: number };

export function rangeOf(selection: GridSelection): Range | null {
  if (!selection) return null;
  const { anchor, focus } = selection;
  return {
    top: Math.min(anchor.row, focus.row),
    bottom: Math.max(anchor.row, focus.row),
    left: Math.min(anchor.col, focus.col),
    right: Math.max(anchor.col, focus.col),
  };
}

export function isSelected(range: Range | null, row: number, col: number): boolean {
  return (
    range !== null &&
    row >= range.top &&
    row <= range.bottom &&
    col >= range.left &&
    col <= range.right
  );
}

function clamp(pos: CellPos, bounds: Bounds): CellPos {
  return {
    row: Math.max(0, Math.min(pos.row, bounds.rows - 1)),
    col: Math.max(0, Math.min(pos.col, bounds.cols - 1)),
  };
}

export function select(pos: CellPos, extend: boolean, current: GridSelection): GridSelection {
  return extend && current ? { anchor: current.anchor, focus: pos } : { anchor: pos, focus: pos };
}

export function selectRow(
  row: number,
  cols: number,
  extend: boolean,
  current: GridSelection,
): GridSelection {
  const anchor = extend && current ? { row: current.anchor.row, col: 0 } : { row, col: 0 };
  return { anchor, focus: { row, col: cols - 1 } };
}

export function selectAll(bounds: Bounds): GridSelection {
  if (bounds.rows === 0 || bounds.cols === 0) return null;
  return { anchor: { row: 0, col: 0 }, focus: { row: bounds.rows - 1, col: bounds.cols - 1 } };
}

type KeyInput = { key: string; shiftKey: boolean; mod: boolean };

/** The selection after a navigation key, or `undefined` when the key does not navigate. */
export function navigate(
  selection: GridSelection,
  input: KeyInput,
  bounds: Bounds,
): GridSelection | undefined {
  if (bounds.rows === 0 || bounds.cols === 0) return undefined;
  const focus = selection?.focus ?? { row: 0, col: 0 };
  const moves: Record<string, () => CellPos> = {
    ArrowUp: () => ({ row: input.mod ? 0 : focus.row - 1, col: focus.col }),
    ArrowDown: () => ({ row: input.mod ? bounds.rows - 1 : focus.row + 1, col: focus.col }),
    ArrowLeft: () => ({ row: focus.row, col: input.mod ? 0 : focus.col - 1 }),
    ArrowRight: () => ({ row: focus.row, col: input.mod ? bounds.cols - 1 : focus.col + 1 }),
    Home: () => (input.mod ? { row: 0, col: 0 } : { row: focus.row, col: 0 }),
    End: () =>
      input.mod
        ? { row: bounds.rows - 1, col: bounds.cols - 1 }
        : { row: focus.row, col: bounds.cols - 1 },
    PageUp: () => ({ row: focus.row - bounds.pageRows, col: focus.col }),
    PageDown: () => ({ row: focus.row + bounds.pageRows, col: focus.col }),
  };
  const move = moves[input.key];
  if (!move) return undefined;
  return select(clamp(move(), bounds), input.shiftKey, selection ?? { anchor: focus, focus });
}
