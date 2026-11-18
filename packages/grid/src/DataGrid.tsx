import { copyWithToast } from "@roost/ui";
import { isMac } from "@roost/shortcuts";
import { useVirtualizer } from "@tanstack/react-virtual";
import { type KeyboardEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";

import { Cell } from "./Cell";
import { CellEditor, type Editing } from "./CellEditor";
import { toTsv } from "./copy";
import { HeaderCell } from "./HeaderCell";
import { pressed } from "./keys";
import { ROW_CLASS, rowState } from "./rowState";
import {
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
import type { CellAdapter, GridColumnBase, GridEditing, SortKey } from "./types";
import { MIN_WIDTH, columnWidth } from "./widths";

type Props<V, C extends GridColumnBase> = {
  columns: C[];
  rows: V[][];
  /** How values and columns are shown, sized and copied. */
  cells: CellAdapter<V, C>;
  /** Row numbers start after this many rows (the page offset). */
  rowOffset?: number;
  /** Server-side sort shown in the headers; clicking a header calls `onSort`. */
  sort?: SortKey[];
  onSort?: (column: string, additive: boolean) => void;
  /** The focused cell changed (the cell viewer follows it). */
  onFocusCell?: (cell: CellPos | null) => void;
  /** Enter or double-click on a cell. */
  onActivate?: (cell: CellPos) => void;
  /** The link in a foreign key cell. */
  onFollow?: (cell: CellPos) => void;
  /** Changing this clears the selection (a new page); defaults to `rows`. */
  resetKey?: unknown;
  /** The selected range changed (toolbar actions use it). */
  onSelectionChange?: (range: Range | null) => void;
  /** Inline editing (task 7.7); without it the grid is read-only. */
  edit?: GridEditing<V>;
};

const ROW_HEIGHT = 24;
const ROW_NUMBER_WIDTH = 56;
const OVERSCAN_ROWS = 12;
const OVERSCAN_COLS = 4;

/** Row- and column-virtualised grid with selection, keyboard navigation, resizing and copy. */
export function DataGrid<V, C extends GridColumnBase>({
  columns,
  rows,
  cells,
  rowOffset = 0,
  sort = [],
  onSort,
  onFocusCell,
  onActivate,
  onFollow,
  resetKey,
  onSelectionChange,
  edit,
}: Props<V, C>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<GridSelection>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const reset = resetKey ?? rows;
  // Widths follow the page, not every pending edit.
  const autoWidths = useMemo(
    () => columns.map((c, i) => columnWidth(c.name, rows, i, cells.widthText)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, reset, cells],
  );
  const widthOf = (index: number) =>
    widths[columns[index]?.name ?? ""] ?? autoWidths[index] ?? MIN_WIDTH;
  const dragging = useRef(false);
  useEffect(() => {
    const stop = () => {
      dragging.current = false;
    };
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
    };
  }, []);

  // The app does not use the React Compiler, so its memoisation warning does not apply.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_ROWS,
    scrollPaddingStart: ROW_HEIGHT,
  });
  const colVirtualizer = useVirtualizer({
    horizontal: true,
    count: columns.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: widthOf,
    overscan: OVERSCAN_COLS,
    scrollPaddingStart: ROW_NUMBER_WIDTH,
  });
  useEffect(() => {
    colVirtualizer.measure();
  }, [widths, autoWidths, colVirtualizer]);

  // A new result clears the selection.
  useEffect(() => {
    setSelection(null);
    setEditing(null);
  }, [reset, columns]);

  const range = rangeOf(selection);
  useEffect(() => {
    onSelectionChange?.(range);
    // Only the range matters, not the callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.top, range?.bottom, range?.left, range?.right]);
  const focus = selection?.focus ?? null;
  useEffect(() => {
    onFocusCell?.(focus);
    // Only the position matters, not the callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.row, focus?.col]);

  const totalWidth = ROW_NUMBER_WIDTH + colVirtualizer.getTotalSize();
  const bounds = {
    rows: rows.length,
    cols: columns.length,
    pageRows: Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 400) / ROW_HEIGHT) - 1),
  };

  const move = (next: GridSelection) => {
    setSelection(next);
    if (next) {
      rowVirtualizer.scrollToIndex(next.focus.row);
      colVirtualizer.scrollToIndex(next.focus.col);
    }
  };

  /** Starts editing a cell the way its type is edited; returns whether anything happened. */
  const startEdit = (cell: CellPos, typed?: string): boolean => {
    if (!edit || edit.mark(cell.row).deleted) return false;
    switch (edit.kind(cell)) {
      case "text":
      case "number":
      case "temporal":
        setEditing({ cell, draft: typed ?? edit.initialText(cell), error: null });
        return true;
      case "bool":
        edit.onToggle(cell);
        return true;
      case "long":
        edit.onEditLong(cell);
        return true;
      case "binary":
      case "none":
        return false;
    }
  };

  /** Ends editing; `move` steps the selection after a successful commit. */
  const finishEdit = (commit: boolean, move?: { row: number; col: number }): boolean => {
    if (!editing || !edit) return true;
    if (commit) {
      const parsed = edit.parse(editing.cell, editing.draft);
      if ("error" in parsed) {
        setEditing({ ...editing, error: parsed.error });
        return false;
      }
      edit.onCommit(editing.cell, parsed.value);
    }
    setEditing(null);
    const target = move
      ? {
          row: Math.max(0, Math.min(rows.length - 1, editing.cell.row + move.row)),
          col: Math.max(0, Math.min(columns.length - 1, editing.cell.col + move.col)),
        }
      : editing.cell;
    setSelection({ anchor: target, focus: target });
    scrollRef.current?.focus();
    // Tab carries on editing in the next cell, like a spreadsheet.
    const across =
      move !== undefined &&
      move.col !== 0 &&
      (target.row !== editing.cell.row || target.col !== editing.cell.col);
    if (across) startEdit(target);
    return true;
  };

  const selectedCells = (): CellPos[] => {
    if (!range) return [];
    const cells: CellPos[] = [];
    for (let row = range.top; row <= range.bottom; row++) {
      for (let col = range.left; col <= range.right; col++) cells.push({ row, col });
    }
    return cells;
  };

  const onEditKeys = (event: KeyboardEvent<HTMLDivElement>, mod: boolean): boolean => {
    if (!edit || !range) return false;
    if (pressed(event, "grid-set-null")) {
      edit.onSetNull(selectedCells());
      return true;
    }
    if (pressed(event, "grid-delete-rows")) {
      const selectedRows = Array.from(
        { length: range.bottom - range.top + 1 },
        (_, i) => range.top + i,
      );
      edit.onDeleteRows(selectedRows);
      return true;
    }
    if (!focus) return false;
    if (pressed(event, "grid-edit")) return startEdit(focus);
    // Typing starts editing with what was typed.
    if (event.key.length === 1 && !mod && !event.altKey && edit.kind(focus) !== "bool") {
      return edit.kind(focus) !== "long" && startEdit(focus, event.key);
    }
    return false;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const mod = isMac() ? event.metaKey : event.ctrlKey;
    if (onEditKeys(event, mod)) {
      event.preventDefault();
      return;
    }
    if (pressed(event, "grid-select-all")) {
      event.preventDefault();
      setSelection(selectAll(bounds));
      return;
    }
    if (pressed(event, "grid-copy") && range) {
      event.preventDefault();
      const count = range.bottom - range.top + 1;
      void copyWithToast(
        toTsv(rows, range, cells.copyText),
        `${count} ${count === 1 ? "row" : "rows"}`,
      );
      return;
    }
    if (event.key === "Enter" && focus) {
      event.preventDefault();
      onActivate?.(focus);
      return;
    }
    if (pressed(event, "grid-clear-selection")) {
      setSelection(null);
      return;
    }
    const next = navigate(selection, { key: event.key, shiftKey: event.shiftKey, mod }, bounds);
    if (next === undefined) return;
    event.preventDefault();
    move(next);
  };

  const startResize = (event: PointerEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    const name = columns[index]?.name ?? "";
    const startX = event.clientX;
    const startWidth = widthOf(index);
    const onMove = (e: globalThis.PointerEvent) => {
      setWidths((current) => ({
        ...current,
        [name]: Math.max(MIN_WIDTH, startWidth + e.clientX - startX),
      }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const autoSize = (index: number) => {
    const column = columns[index];
    if (!column) return;
    setWidths((current) => ({
      ...current,
      [column.name]: columnWidth(column.name, rows, index, cells.widthText, true),
    }));
  };

  const virtualCols = colVirtualizer.getVirtualItems();
  return (
    <div
      ref={scrollRef}
      role="grid"
      aria-rowcount={rows.length + 1}
      aria-colcount={columns.length + 1}
      aria-multiselectable="true"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="relative h-full overflow-auto font-mono text-xs outline-none focus-visible:ring-1 focus-visible:ring-sky-600"
    >
      <div
        style={{
          width: totalWidth,
          height: rowVirtualizer.getTotalSize() + ROW_HEIGHT,
          position: "relative",
        }}
      >
        <div
          role="row"
          aria-rowindex={1}
          className="sticky top-0 z-20 border-b border-zinc-700 bg-zinc-800"
          style={{ width: totalWidth, height: ROW_HEIGHT }}
        >
          <div
            role="columnheader"
            aria-colindex={1}
            className="sticky left-0 z-30 h-full bg-zinc-800 px-2 py-1 text-right text-zinc-500"
            style={{ width: ROW_NUMBER_WIDTH }}
            onClick={() => {
              setSelection(selectAll(bounds));
            }}
          >
            #
          </div>
          {virtualCols.map((item) => {
            const column = columns[item.index];
            if (!column) return null;
            return (
              <HeaderCell
                key={item.key}
                column={column}
                {...cells.header(column)}
                index={item.index}
                left={ROW_NUMBER_WIDTH + item.start}
                width={item.size}
                sort={sort}
                onSort={onSort}
                onResize={startResize}
                onAutoSize={autoSize}
              />
            );
          })}
        </div>
        {rowVirtualizer.getVirtualItems().map((rowItem) => {
          const row = rows[rowItem.index] ?? [];
          const rowMark = edit?.mark(rowItem.index);
          return (
            <div
              key={rowItem.key}
              role="row"
              aria-rowindex={rowItem.index + 2}
              data-state={rowState(rowMark)}
              className={`absolute left-0 border-b border-zinc-800/80 ${ROW_CLASS[rowState(rowMark)]}`}
              style={{ top: ROW_HEIGHT + rowItem.start, height: ROW_HEIGHT, width: totalWidth }}
            >
              <div
                role="rowheader"
                aria-colindex={1}
                className="sticky left-0 z-10 h-full cursor-default bg-zinc-900 px-2 py-1 text-right text-zinc-600"
                style={{ width: ROW_NUMBER_WIDTH }}
                onPointerDown={(e) => {
                  setSelection(selectRow(rowItem.index, columns.length, e.shiftKey, selection));
                }}
              >
                {rowOffset + rowItem.index + 1}
              </div>
              {virtualCols.map((colItem) => {
                const column = columns[colItem.index];
                const value = row[colItem.index];
                if (!column || value === undefined) return null;
                const pos = { row: rowItem.index, col: colItem.index };
                const mark = rowMark;
                if (
                  editing &&
                  editing.cell.row === pos.row &&
                  editing.cell.col === pos.col &&
                  edit
                ) {
                  return (
                    <CellEditor
                      key={colItem.key}
                      left={ROW_NUMBER_WIDTH + colItem.start}
                      width={colItem.size}
                      columnName={column.name}
                      editing={editing}
                      hint={edit.hint(pos)}
                      onChange={(draft) => {
                        setEditing({ ...editing, draft, error: null });
                      }}
                      onFinish={finishEdit}
                    />
                  );
                }
                return (
                  <Cell
                    key={colItem.key}
                    edited={mark?.edited.includes(column.name) ?? false}
                    original={mark?.originals[column.name]}
                    value={value}
                    cells={cells}
                    column={column}
                    colIndex={colItem.index}
                    left={ROW_NUMBER_WIDTH + colItem.start}
                    width={colItem.size}
                    selected={isSelected(range, pos.row, pos.col)}
                    focused={focus?.row === pos.row && focus.col === pos.col}
                    onPointerDown={(extend) => {
                      dragging.current = true;
                      setSelection((current) => select(pos, extend, current));
                    }}
                    onPointerEnter={() => {
                      if (dragging.current) setSelection((current) => select(pos, true, current));
                    }}
                    onPointerUp={() => {
                      dragging.current = false;
                    }}
                    onActivate={() => {
                      if (!startEdit(pos)) onActivate?.(pos);
                    }}
                    onFollow={
                      onFollow && column.references
                        ? () => {
                            onFollow(pos);
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
