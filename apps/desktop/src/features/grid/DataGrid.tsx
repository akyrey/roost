import { useVirtualizer } from "@tanstack/react-virtual";
import { type KeyboardEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";

import type { SortKey, TypeCategory, Value } from "../../ipc";
import { copyText } from "../../lib/clipboard";
import { toTsv } from "./copy";
import { KIND_CLASS, present } from "./present";
import {
  type CellPos,
  type GridSelection,
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
};

const ROW_HEIGHT = 24;
const ROW_NUMBER_WIDTH = 56;
const OVERSCAN_ROWS = 12;
const OVERSCAN_COLS = 4;

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

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
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<GridSelection>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const autoWidths = useMemo(
    () => columns.map((c, i) => columnWidth(c.name, rows, i)),
    [columns, rows],
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
  }, [rows, columns]);

  const range = rangeOf(selection);
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

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const mod = isMac() ? event.metaKey : event.ctrlKey;
    if (mod && event.key.toLowerCase() === "a") {
      event.preventDefault();
      setSelection(selectAll(bounds));
      return;
    }
    if (mod && event.key.toLowerCase() === "c" && range) {
      event.preventDefault();
      void copyText(toTsv(rows, range));
      return;
    }
    if (event.key === "Enter" && focus) {
      event.preventDefault();
      onActivate?.(focus);
      return;
    }
    if (event.key === "Escape") {
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
          return (
            <div
              key={rowItem.key}
              role="row"
              aria-rowindex={rowItem.index + 2}
              className="absolute left-0 border-b border-zinc-800/80"
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
                return (
                  <Cell
                    key={colItem.key}
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
                      onActivate?.(pos);
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
      title={`${column.name} · ${column.typeName || column.category}${onSort ? " · click to sort, shift-click to add" : ""}`}
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
        <span className="truncate text-[10px] font-normal text-zinc-500">{column.typeName}</span>
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
  const { value, column, colIndex, left, width, selected, focused, onFollow } = props;
  const shown = present(value, column.category);
  return (
    <div
      role="gridcell"
      aria-colindex={colIndex + 2}
      aria-selected={selected}
      title={shown.text}
      className={`absolute top-0 flex h-full items-center gap-1 px-2 ${shown.alignRight ? "justify-end" : ""} ${selected ? "bg-sky-900/50" : ""} ${focused ? "outline outline-1 -outline-offset-1 outline-sky-500" : ""}`}
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
