import { type KeyboardEvent, useId, useMemo, useState } from "react";

import { shortcutLabel } from "../shortcuts/registry";
import type { PaletteCommand } from "./commands";
import { filterByQuery } from "./match";

/** Rows shown at once; typing narrows the rest. */
const MAX_SHOWN = 50;

type Props = { commands: readonly PaletteCommand[]; onClose: () => void };

/** The command palette (task 8.9): type to filter, arrows to choose, Enter to run. */
export function CommandPalette({ commands, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState(0);
  const listId = useId();
  const shown = useMemo(
    () =>
      filterByQuery(commands, query, (c) => `${c.label} ${c.detail ?? ""} ${c.group}`).slice(
        0,
        MAX_SHOWN,
      ),
    [commands, query],
  );
  const index = Math.min(chosen, Math.max(shown.length - 1, 0));

  const run = (command: PaletteCommand | undefined) => {
    if (!command) return;
    onClose();
    command.run();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
    const step = moves[event.key];
    if (step !== undefined && shown.length > 0) {
      event.preventDefault();
      setChosen((index + step + shown.length) % shown.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(shown[index]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-[36rem] max-w-[90vw] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl"
      >
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={shown[index] ? `${listId}-${index}` : undefined}
          aria-label="Search commands, connections, tables and saved queries"
          placeholder="Search commands, connections, tables and saved queries"
          className="w-full border-b border-zinc-800 bg-transparent px-4 py-3 text-sm text-zinc-100 outline-none"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setChosen(0);
          }}
          onKeyDown={onKeyDown}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label="Results"
          className="max-h-80 overflow-y-auto py-1"
        >
          {shown.length === 0 && <li className="px-4 py-2 text-sm text-zinc-500">No matches.</li>}
          {shown.map((command, i) => (
            <li
              key={command.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === index}
              className={`flex cursor-default items-center gap-3 px-4 py-1.5 text-sm ${i === index ? "bg-sky-900/60 text-zinc-100" : "text-zinc-300"}`}
              onPointerMove={() => {
                setChosen(i);
              }}
              onClick={() => {
                run(command);
              }}
            >
              <span className="w-24 shrink-0 text-xs text-zinc-500">{command.group}</span>
              <span className="flex-1 truncate">{command.label}</span>
              {(command.shortcut ?? command.detail) && (
                <span className="text-xs text-zinc-500">
                  {command.shortcut ? shortcutLabel(command.shortcut) : command.detail}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
