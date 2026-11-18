import type { PointerEvent } from "react";

import type { GridColumnBase, HeaderBadge, SortKey } from "./types";

type HeaderProps<C extends GridColumnBase> = {
  column: C;
  detail: string;
  badges: readonly HeaderBadge[];
  index: number;
  left: number;
  width: number;
  sort: SortKey[];
  onSort: ((column: string, additive: boolean) => void) | undefined;
  onResize: (event: PointerEvent<HTMLDivElement>, index: number) => void;
  onAutoSize: (index: number) => void;
};

export function HeaderCell<C extends GridColumnBase>({
  column,
  detail,
  badges,
  index,
  left,
  width,
  sort,
  onSort,
  onResize,
  onAutoSize,
}: HeaderProps<C>) {
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
      title={`${column.name}\n${detail}${onSort ? "\nClick to sort, shift-click to add" : ""}`}
    >
      <button
        type="button"
        disabled={!onSort}
        aria-label={onSort ? `Sort by ${column.name}` : column.name}
        className="flex min-w-0 flex-1 items-center gap-1 px-2 text-left disabled:cursor-default"
        onClick={(e) => onSort?.(column.name, e.shiftKey)}
      >
        {badges.map((badge) => (
          <span key={badge.text} className={`text-[9px] font-bold ${badge.className}`}>
            {badge.text}
          </span>
        ))}
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
