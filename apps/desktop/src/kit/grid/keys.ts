import { matchesBinding } from "@roost/shortcuts";
import type { KeyboardEvent } from "react";

export type GridShortcutId =
  | "grid-copy"
  | "grid-select-all"
  | "grid-edit"
  | "grid-set-null"
  | "grid-delete-rows"
  | "grid-clear-selection";

/** The grid's keys; an app lists them in its shortcuts dialog with its own descriptions. */
export const GRID_KEYS: Readonly<Record<GridShortcutId, readonly string[]>> = {
  "grid-copy": ["Mod-c"],
  "grid-select-all": ["Mod-a"],
  "grid-edit": ["Enter", "F2"],
  "grid-set-null": ["Mod-Shift-Backspace"],
  "grid-delete-rows": ["Mod-Backspace"],
  "grid-clear-selection": ["Escape"],
};

/** Whether `event` is one of the keys for `id`. */
export const pressed = (event: KeyboardEvent<HTMLDivElement>, id: GridShortcutId): boolean =>
  GRID_KEYS[id].some((binding) => matchesBinding(event, binding));
