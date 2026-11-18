import { ShortcutsView as KitShortcutsView } from "@roost/shortcuts";

import { SHORTCUT_GROUPS, registry } from "./registry";

/** Every shortcut, from the registry (task 8.10). */
export function ShortcutsView({ onClose }: { onClose: () => void }) {
  return <KitShortcutsView registry={registry} groups={SHORTCUT_GROUPS} onClose={onClose} />;
}
