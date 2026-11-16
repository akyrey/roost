import { useVirtualizer } from "@tanstack/react-virtual";
import { type KeyboardEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";

import type { SortKey, TypeCategory, Value } from "../../ipc";
import type { EditorKind, Parsed } from "../edit/editors";
import { copyWithToast } from "../../lib/copy";
import { NO_TEXT_SUBSTITUTION } from "../../lib/quotes";
import { toTsv } from "./copy";
import { useSettings } from "../settings/settingsStore";
import { type ShortcutId, isMac, keysOf, matchesBinding } from "../shortcuts/registry";
import { KIND_CLASS, present } from "./present";
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
import { MIN_WIDTH, columnWidth } from "./widths";

export type GridColumn = {
  name: string;
  typeName: string;
  category: TypeCategory;
  primaryKey?: boolean;
  /** The referenced table, when the column is (the first column of) a foreign key. */
  references?: string;
};

type Props = {
  columns: GridColumn[];
  rows: Value[][];
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
  edit?: GridEditing;
};

export type RowMark = {
  inserted: boolean;
  deleted: boolean;
  /** Columns with a pending value. */
  edited: string[];
  /** Values before the pending edits, shown on hover. */
  originals: Record<string, Value>;
  /** The last Apply failed on this row. */
  failed: boolean;
};

export type GridEditing = {
  mark: (row: number) => RowMark;
  /** How a cell is edited; `none` and `binary` cells are not edited inline. */
  kind: (cell: CellPos) => EditorKind;
  initialText: (cell: CellPos) => string;
  parse: (cell: CellPos, text: string) => Parsed;
  hint: (cell: CellPos) => string | undefined;
  onCommit: (cell: CellPos, value: Value) => void;
  /** Bool cells toggle without an editor. */
  onToggle: (cell: CellPos) => void;
  /** JSON, XML and long text are edited in the cell viewer. */
  onEditLong: (cell: CellPos) => void;
  onSetNull: (cells: CellPos[]) => void;
  onDeleteRows: (rows: number[]) => void;
};

type Editing = { cell: CellPos; draft: string; error: string | null };

/** Whether `event` is one of the registry's keys for `id`. */
const pressed = (event: KeyboardEvent<HTMLDivElement>, id: ShortcutId): boolean =>
  keysOf(id).some((binding) => matchesBinding(event, binding));

const ROW_HEIGHT = 24;
const ROW_NUMBER_WIDTH = 56;
const OVERSCAN_ROWS = 12;
const OVERSCAN_COLS = 4;

/** Row- and column-virtualised grid with selection, keyboard navigation, resizing and copy. */
export function DataGrid({
  columns,
  rows,
  rowOffset = 0,
  sort = [],
  onSort,
  onFocusCell,
  onActivate,
  onFollow,
  resetKey,
  onSelectionChange,
  edit,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<GridSelection>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const reset = resetKey ?? rows;
  // Widths follow the page, not every pending edit.
  const autoWidths = useMemo(
    () => columns.map((c, i) => columnWidth(c.name, rows, i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, reset],
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
      void copyWithToast(toTsv(rows, range), `${count} ${count === 1 ? "row" : "rows"}`);
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
      [column.name]: columnWidth(column.name, rows, index, true),
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
                if (!column || !value) return null;
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
                      column={column}
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

type HeaderProps = {
  column: GridColumn;
  index: number;
  left: number;
  width: number;
  sort: SortKey[];
  onSort: Props["onSort"];
  onResize: (event: PointerEvent<HTMLDivElement>, index: number) => void;
  onAutoSize: (index: number) => void;
};

function HeaderCell({
  column,
  index,
  left,
  width,
  sort,
  onSort,
  onResize,
  onAutoSize,
}: HeaderProps) {
  const position = sort.findIndex((s) => s.column === column.name);
  const sorted = sort[position];
  const ariaSort = sorted ? (sorted.descending ? "descending" : "ascending") : "none";
  return (
    <div
      role="columnheader"
      aria-label={column.name}
      aria-colindex={index + 2}
      aria-sort={onSort ? ariaSort : undefined}
      className="absolute top-0 flex h-full items-center"
      style={{ left, width }}
      title={`${column.name}\n${column.typeName || column.category}${onSort ? "\nClick to sort, shift-click to add" : ""}`}
    >
      <button
        type="button"
        disabled={!onSort}
        aria-label={onSort ? `Sort by ${column.name}` : column.name}
        className="flex min-w-0 flex-1 items-center gap-1 px-2 text-left disabled:cursor-default"
        onClick={(e) => onSort?.(column.name, e.shiftKey)}
      >
        {column.primaryKey && <span className="text-[9px] font-bold text-amber-300">PK</span>}
        {column.references && <span className="text-[9px] font-bold text-sky-300">FK</span>}
        <span className="truncate font-semibold text-zinc-200">{column.name}</span>
        {sorted && (
          <span className="ml-auto text-sky-300" aria-hidden="true">
            {sorted.descending ? "▼" : "▲"}
            {sort.length > 1 ? position + 1 : ""}
          </span>
        )}
      </button>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${column.name}`}
        className="h-full w-1.5 shrink-0 cursor-col-resize hover:bg-sky-600"
        onPointerDown={(e) => {
          onResize(e, index);
        }}
        onDoubleClick={() => {
          onAutoSize(index);
        }}
      />
    </div>
  );
}

type CellProps = {
  value: Value;
  /** The cell has a pending value. */
  edited: boolean;
  original: Value | undefined;
  column: GridColumn;
  colIndex: number;
  left: number;
  width: number;
  selected: boolean;
  focused: boolean;
  onPointerDown: (extend: boolean) => void;
  onPointerEnter: () => void;
  onPointerUp: () => void;
  onActivate: () => void;
  onFollow: (() => void) | undefined;
};

function Cell(props: CellProps) {
  const { value, column, colIndex, left, width, selected, focused, onFollow, edited, original } =
    props;
  const nullText = useSettings((s) => s.settings.nullText);
  const shown = present(value, column.category, nullText);
  const title =
    edited && original
      ? `${shown.text}\nOriginal: ${present(original, column.category, nullText).text}`
      : shown.text;
  return (
    <div
      role="gridcell"
      aria-colindex={colIndex + 2}
      aria-selected={selected}
      data-edited={edited || undefined}
      title={title}
      className={`absolute top-0 flex h-full items-center gap-1 px-2 ${shown.alignRight ? "justify-end" : ""} ${edited ? "bg-amber-900/40" : ""} ${selected ? "bg-sky-900/50" : ""} ${focused ? "outline outline-1 -outline-offset-1 outline-sky-500" : ""}`}
      style={{ left, width }}
      onPointerDown={(e) => {
        if (e.button === 0) props.onPointerDown(e.shiftKey);
      }}
      onPointerEnter={props.onPointerEnter}
      onPointerUp={props.onPointerUp}
      onDoubleClick={props.onActivate}
    >
      <span className={`truncate ${KIND_CLASS[shown.kind]}`}>{shown.text}</span>
      {onFollow && value.t !== "null" && (
        <button
          type="button"
          aria-label={`Open the ${column.references ?? ""} row`}
          title={`Open the referenced row in ${column.references ?? ""}`}
          className="shrink-0 text-sky-400 hover:text-sky-200"
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onClick={onFollow}
        >
          ↗
        </button>
      )}
    </div>
  );
}

type RowState = "normal" | "inserted" | "deleted" | "failed";

function rowState(mark: RowMark | undefined): RowState {
  if (!mark) return "normal";
  if (mark.failed) return "failed";
  if (mark.deleted) return "deleted";
  return mark.inserted ? "inserted" : "normal";
}

const ROW_CLASS: Record<RowState, string> = {
  normal: "",
  inserted: "bg-emerald-950/60",
  deleted: "bg-rose-950/60 line-through opacity-70",
  failed: "bg-rose-900/60 ring-1 ring-inset ring-rose-500",
};

type EditorProps = {
  left: number;
  width: number;
  column: GridColumn;
  editing: Editing;
  hint: string | undefined;
  onChange: (draft: string) => void;
  /** Returns whether editing ended (an invalid value keeps it open). */
  onFinish: (commit: boolean, move?: { row: number; col: number }) => boolean;
};

/** The inline editor: Enter commits and moves down, Tab across, Escape cancels. */
function CellEditor({ left, width, column, editing, hint, onChange, onFinish }: EditorProps) {
  // Escape, then the blur of the removed input, must not commit.
  const done = useRef(false);
  const finish = (commit: boolean, move?: { row: number; col: number }) => {
    if (done.current) return;
    // Finishing moves focus back to the grid, which blurs this input at once: mark it done
    // first so that blur does not finish a second time.
    done.current = true;
    done.current = onFinish(commit, move);
  };
  return (
    <div
      role="gridcell"
      aria-colindex={editing.cell.col + 2}
      className="absolute top-0 z-10 h-full"
      style={{ left, width: Math.max(width, 160) }}
    >
      <input
        aria-label={`Edit ${column.name}`}
        aria-invalid={editing.error !== null}
        title={editing.error ?? hint}
        placeholder={hint}
        autoFocus
        {...NO_TEXT_SUBSTITUTION}
        className={`h-full w-full bg-zinc-950 px-2 font-mono text-xs text-zinc-100 outline outline-1 ${editing.error ? "outline-rose-500" : "outline-sky-500"}`}
        value={editing.draft}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            finish(true, { row: 1, col: 0 });
          } else if (e.key === "Tab") {
            e.preventDefault();
            finish(true, { row: 0, col: e.shiftKey ? -1 : 1 });
          } else if (e.key === "Escape") {
            e.preventDefault();
            finish(false);
          }
        }}
        onBlur={() => {
          finish(true);
        }}
      />
      {editing.error && (
        <p
          role="alert"
          className="absolute left-0 top-full z-20 whitespace-nowrap rounded bg-rose-900 px-2 py-0.5 text-[11px] text-rose-100"
        >
          {editing.error}
        </p>
      )}
    </div>
  );
}
