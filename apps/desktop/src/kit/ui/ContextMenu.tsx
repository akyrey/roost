import { useEffect, useRef } from "react";

export type ContextMenuItem = {
  label: string;
  onSelect: () => void;
  /** Shown in the warning colour (e.g. closing a connection). */
  destructive?: boolean;
};

type Props = {
  /** The menu's accessible name, e.g. "Actions for users". */
  label: string;
  x: number;
  y: number;
  items: readonly ContextMenuItem[];
  onClose: () => void;
};

const ITEM = "px-3 py-1 text-left text-sm hover:bg-zinc-800 focus:bg-zinc-800 focus:outline-none";

/** A floating menu at a point; closes on Escape, an outside click, or choosing an item. */
export function ContextMenu({ label, x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className="fixed z-50 flex min-w-44 flex-col rounded border border-zinc-700 bg-zinc-900 py-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={item.destructive ? `${ITEM} text-rose-300` : ITEM}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
