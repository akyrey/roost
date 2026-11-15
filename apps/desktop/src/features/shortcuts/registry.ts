/** Every keyboard shortcut in the app (task 8.10). Keys use CodeMirror's notation (`Mod` is ⌘ on
 * macOS and Ctrl elsewhere), so the editor binds the same strings it shows. */

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

export type Shortcut = {
  id: ShortcutId;
  group: ShortcutGroup;
  description: string;
  /** Alternatives, each like `Mod-Shift-Enter`. */
  keys: readonly string[];
};

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
  { id: "grid-copy", group: "Grid", description: "Copy the selection as TSV", keys: ["Mod-c"] },
  { id: "grid-select-all", group: "Grid", description: "Select all cells", keys: ["Mod-a"] },
  { id: "grid-edit", group: "Grid", description: "Edit the cell", keys: ["Enter", "F2"] },
  {
    id: "grid-set-null",
    group: "Grid",
    description: "Set the cells to NULL",
    keys: ["Mod-Shift-Backspace"],
  },
  {
    id: "grid-delete-rows",
    group: "Grid",
    description: "Delete the selected rows",
    keys: ["Mod-Backspace"],
  },
  {
    id: "grid-clear-selection",
    group: "Grid",
    description: "Clear the selection",
    keys: ["Escape"],
  },
];

const BY_ID = new Map(SHORTCUTS.map((s) => [s.id, s]));

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

export const isMac = (): boolean =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function keysOf(id: ShortcutId): readonly string[] {
  return BY_ID.get(id)?.keys ?? [];
}

/** The first binding of `id`, for CodeMirror keymaps. */
export function bindingOf(id: ShortcutId): string {
  return keysOf(id)[0] ?? "";
}

const SYMBOLS: Record<string, { mac: string; other: string }> = {
  Mod: { mac: "⌘", other: "Ctrl+" },
  Ctrl: { mac: "⌃", other: "Ctrl+" },
  Alt: { mac: "⌥", other: "Alt+" },
  Shift: { mac: "⇧", other: "Shift+" },
};

const KEY_NAMES: Record<string, string> = {
  ArrowRight: "→",
  ArrowLeft: "←",
  Enter: "↩",
  Backspace: "⌫",
  Escape: "Esc",
};

function formatKey(binding: string, mac: boolean): string {
  const parts = binding.split("-");
  const key = parts.pop() ?? "";
  // "Mod-Shift--" would bind "-"; no shortcut uses it.
  const modifiers = parts.map((m) => SYMBOLS[m]?.[mac ? "mac" : "other"] ?? `${m}+`).join("");
  const name = KEY_NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key);
  return `${modifiers}${name}`;
}

/** How a shortcut is shown, e.g. `⌘T` or `Ctrl+T`; alternatives joined with "or". */
export function shortcutLabel(id: ShortcutId, mac = isMac()): string {
  return keysOf(id)
    .map((k) => formatKey(k, mac))
    .join(" or ");
}

type Keys = Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

/** The physical key for a printable character, for when a modifier changes `key`. */
function codeOf(key: string): string | null {
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  const punctuation: Record<string, string> = { "/": "Slash", ",": "Comma", ".": "Period" };
  return punctuation[key] ?? null;
}

export function matchesBinding(event: Keys, binding: string, mac = isMac()): boolean {
  const parts = binding.split("-");
  const key = parts.pop() ?? "";
  const mods = new Set(parts);
  const wantMeta = mac && mods.has("Mod");
  const wantCtrl = mods.has("Ctrl") || (!mac && mods.has("Mod"));
  if (event.metaKey !== wantMeta || event.ctrlKey !== wantCtrl) return false;
  if (event.altKey !== mods.has("Alt") || event.shiftKey !== mods.has("Shift")) return false;
  // With Option or Shift held, `key` is the composed character (`®`, `?`); `code` is the key.
  const code = codeOf(key);
  if (code && (event.altKey || event.shiftKey)) return event.code === code;
  return event.key.toLowerCase() === key.toLowerCase();
}

/** The window-level shortcut `event` triggers, if any. */
export function matchShortcut(event: Keys, mac = isMac()): ShortcutId | null {
  return GLOBAL.find((id) => keysOf(id).some((k) => matchesBinding(event, k, mac))) ?? null;
}
