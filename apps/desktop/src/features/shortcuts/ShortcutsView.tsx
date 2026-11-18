import { Button, Modal } from "@roost/ui";
import { SHORTCUTS, type ShortcutGroup, shortcutLabel } from "./registry";

const GROUPS: ShortcutGroup[] = ["General", "Tabs", "Editor", "Grid"];

/** Every shortcut, from the registry (task 8.10). */
export function ShortcutsView({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="Keyboard shortcuts"
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto text-sm">
        {GROUPS.map((group) => (
          <section key={group} aria-label={group}>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {group}
            </h2>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
              {SHORTCUTS.filter((s) => s.group === group).map((s) => (
                <div key={s.id} className="contents">
                  <dt className="text-zinc-300">{s.description}</dt>
                  <dd className="font-mono text-xs text-zinc-400">{shortcutLabel(s.id)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
