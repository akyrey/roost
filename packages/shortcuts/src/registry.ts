/** Keyboard shortcuts: an app declares its own and gets lookup, labels and matching. Keys use
 * CodeMirror's notation (`Mod` is ⌘ on macOS and Ctrl elsewhere), so an editor can bind the same
 * strings the app shows. */

export type Shortcut<Id extends string = string, Group extends string = string> = {
  id: Id;
  group: Group;
  description: string;
  /** Alternatives, each like `Mod-Shift-Enter`. */
  keys: readonly string[];
};

export type KeyChord = Pick<
  KeyboardEvent,
  "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

export type ShortcutRegistry<Id extends string, Group extends string> = {
  all: readonly Shortcut<Id, Group>[];
  keysOf: (id: Id) => readonly string[];
  /** The first binding of `id`, for CodeMirror keymaps. */
  bindingOf: (id: Id) => string;
  /** How a shortcut is shown, e.g. `⌘T` or `Ctrl+T`; alternatives joined with "or". */
  shortcutLabel: (id: Id, mac?: boolean) => string;
  /** The window-level shortcut `event` triggers, if any. */
  matchShortcut: (event: KeyChord, mac?: boolean) => Id | null;
};

export const isMac = (): boolean =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

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

/** One binding as shown, e.g. `Mod-Shift-Enter` → `⌘⇧↩`. */
export function formatBinding(binding: string, mac: boolean): string {
  const parts = binding.split("-");
  const key = parts.pop() ?? "";
  // "Mod-Shift--" would bind "-"; no shortcut uses it.
  const modifiers = parts.map((m) => SYMBOLS[m]?.[mac ? "mac" : "other"] ?? `${m}+`).join("");
  const name = KEY_NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key);
  return `${modifiers}${name}`;
}

/** The physical key for a printable character, for when a modifier changes `key`. */
function codeOf(key: string): string | null {
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  const punctuation: Record<string, string> = { "/": "Slash", ",": "Comma", ".": "Period" };
  return punctuation[key] ?? null;
}

export function matchesBinding(event: KeyChord, binding: string, mac = isMac()): boolean {
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

/** A registry over `shortcuts`; `global` are the ones handled at window level (an editor or a
 * grid handles the others itself). Throws on a duplicate id, a programming error. */
export function createShortcutRegistry<Id extends string, Group extends string>(
  shortcuts: readonly Shortcut<Id, Group>[],
  global: readonly Id[],
): ShortcutRegistry<Id, Group> {
  const byId = new Map<Id, Shortcut<Id, Group>>();
  for (const shortcut of shortcuts) {
    if (byId.has(shortcut.id)) throw new Error(`Duplicate shortcut id: ${shortcut.id}`);
    byId.set(shortcut.id, shortcut);
  }
  const keysOf = (id: Id): readonly string[] => byId.get(id)?.keys ?? [];
  return {
    all: shortcuts,
    keysOf,
    bindingOf: (id) => keysOf(id)[0] ?? "",
    shortcutLabel: (id, mac = isMac()) =>
      keysOf(id)
        .map((k) => formatBinding(k, mac))
        .join(" or "),
    matchShortcut: (event, mac = isMac()) =>
      global.find((id) => keysOf(id).some((k) => matchesBinding(event, k, mac))) ?? null,
  };
}
