// @roost/shortcuts: keyboard shortcut registry, matching and the shortcuts dialog.
export {
  type KeyChord,
  type Shortcut,
  type ShortcutRegistry,
  createShortcutRegistry,
  formatBinding,
  isMac,
  matchesBinding,
} from "./registry";
export { ShortcutsView } from "./ShortcutsView";
