import { NO_TEXT_SUBSTITUTION } from "@roost/ui";
import { useRef } from "react";

import type { CellPos } from "./selection";

export type Editing = { cell: CellPos; draft: string; error: string | null };

type EditorProps = {
  left: number;
  width: number;
  columnName: string;
  editing: Editing;
  hint: string | undefined;
  onChange: (draft: string) => void;
  /** Returns whether editing ended (an invalid value keeps it open). */
  onFinish: (commit: boolean, move?: { row: number; col: number }) => boolean;
};

/** The inline editor: Enter commits and moves down, Tab across, Escape cancels. */
export function CellEditor({
  left,
  width,
  columnName,
  editing,
  hint,
  onChange,
  onFinish,
}: EditorProps) {
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
        aria-label={`Edit ${columnName}`}
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
