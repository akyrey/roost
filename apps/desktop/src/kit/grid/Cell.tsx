import { KIND_CLASS } from "./present";
import type { CellAdapter, GridColumnBase } from "./types";

type CellProps<V, C extends GridColumnBase> = {
  value: V;
  cells: CellAdapter<V, C>;
  /** The cell has a pending value. */
  edited: boolean;
  original: V | undefined;
  column: C;
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

export function Cell<V, C extends GridColumnBase>(props: CellProps<V, C>) {
  const { value, cells, column, colIndex, left, width, selected, focused, onFollow } = props;
  const { edited, original } = props;
  const shown = cells.present(value, column);
  const title =
    edited && original
      ? `${shown.text}\nOriginal: ${cells.present(original, column).text}`
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
      {onFollow && shown.kind !== "null" && (
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
