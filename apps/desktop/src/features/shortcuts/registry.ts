/** Every keyboard shortcut in the app (task 8.10). Lookup, labels and matching come from
 * @roost/shortcuts. */
import { GRID_KEYS } from "@roost/grid";
import { type Shortcut as KitShortcut, createShortcutRegistry } from "@roost/shortcuts";

export type ShortcutGroup = "General" | "Tabs" | "Editor" | "Grid";

export type ShortcutId =
  | "palette"
  | "settings"
  | "shortcuts"
  | "new-tab"
  | "close-tab"
  | "next-tab"
  | "previous-tab"
  | "focus-results"
  | "run-statement"
  | "run-script"
  | "explain"
  | "cancel"
  | "save-query"
  | "toggle-comment"
  | "find"
  | "grid-copy"
  | "grid-select-all"
  | "grid-edit"
  | "grid-set-null"
  | "grid-delete-rows"
  | "grid-clear-selection";

export type Shortcut = KitShortcut<ShortcutId, ShortcutGroup>;

export const SHORTCUTS: readonly Shortcut[] = [
  { id: "palette", group: "General", description: "Command palette", keys: ["Mod-k"] },
  { id: "settings", group: "General", description: "Settings", keys: ["Mod-,"] },
  { id: "shortcuts", group: "General", description: "Keyboard shortcuts", keys: ["Mod-Shift-/"] },
  { id: "new-tab", group: "Tabs", description: "New editor tab", keys: ["Mod-t"] },
  { id: "close-tab", group: "Tabs", description: "Close tab", keys: ["Mod-w"] },
  {
    id: "next-tab",
    group: "Tabs",
    description: "Next tab",
    keys: ["Ctrl-Tab", "Mod-Alt-ArrowRight"],
  },
  {
    id: "previous-tab",
    group: "Tabs",
    description: "Previous tab",
    keys: ["Ctrl-Shift-Tab", "Mod-Alt-ArrowLeft"],
  },
  { id: "focus-results", group: "Tabs", description: "Focus the results", keys: ["Mod-Alt-r"] },
  {
    id: "run-statement",
    group: "Editor",
    description: "Run the statement at the cursor, or the selection",
    keys: ["Mod-Enter"],
  },
  {
    id: "run-script",
    group: "Editor",
    description: "Run the whole script",
    keys: ["Mod-Shift-Enter"],
  },
  {
    id: "explain",
    group: "Editor",
    description: "Explain the statement at the cursor, without running it",
    keys: ["Mod-Shift-e"],
  },
  { id: "cancel", group: "Editor", description: "Cancel the running statement", keys: ["Escape"] },
  { id: "save-query", group: "Editor", description: "Save as a saved query", keys: ["Mod-s"] },
  { id: "toggle-comment", group: "Editor", description: "Toggle comment", keys: ["Mod-/"] },
  { id: "find", group: "Editor", description: "Find and replace", keys: ["Mod-f"] },
  {
    id: "grid-copy",
    group: "Grid",
    description: "Copy the selection as TSV",
    keys: GRID_KEYS["grid-copy"],
  },
  {
    id: "grid-select-all",
    group: "Grid",
    description: "Select all cells",
    keys: GRID_KEYS["grid-select-all"],
  },
  { id: "grid-edit", group: "Grid", description: "Edit the cell", keys: GRID_KEYS["grid-edit"] },
  {
    id: "grid-set-null",
    group: "Grid",
    description: "Set the cells to NULL",
    keys: GRID_KEYS["grid-set-null"],
  },
  {
    id: "grid-delete-rows",
    group: "Grid",
    description: "Delete the selected rows",
    keys: GRID_KEYS["grid-delete-rows"],
  },
  {
    id: "grid-clear-selection",
    group: "Grid",
    description: "Clear the selection",
    keys: GRID_KEYS["grid-clear-selection"],
  },
];

/** Shortcuts handled at window level (the editor and the grid handle their own). */
const GLOBAL: readonly ShortcutId[] = [
  "palette",
  "settings",
  "shortcuts",
  "new-tab",
  "close-tab",
  "next-tab",
  "previous-tab",
  "focus-results",
];

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = ["General", "Tabs", "Editor", "Grid"];

export const registry = createShortcutRegistry(SHORTCUTS, GLOBAL);

export const { keysOf, bindingOf, shortcutLabel, matchShortcut } = registry;

export { isMac, matchesBinding } from "@roost/shortcuts";
