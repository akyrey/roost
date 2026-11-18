import { Button, Modal } from "@roost/ui";

import type { ShortcutRegistry } from "./registry";

type Props<Id extends string, Group extends string> = {
  registry: ShortcutRegistry<Id, Group>;
  /** Sections, in this order; shortcuts in other groups are not shown. */
  groups: readonly Group[];
  onClose: () => void;
};

/** Every shortcut of the registry, by group. */
export function ShortcutsView<Id extends string, Group extends string>({
  registry,
  groups,
  onClose,
}: Props<Id, Group>) {
  return (
    <Modal
      title="Keyboard shortcuts"
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto text-sm">
        {groups.map((group) => (
          <section key={group} aria-label={group}>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {group}
            </h2>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
              {registry.all
                .filter((s) => s.group === group)
                .map((s) => (
                  <div key={s.id} className="contents">
                    <dt className="text-zinc-300">{s.description}</dt>
                    <dd className="font-mono text-xs text-zinc-400">
                      {registry.shortcutLabel(s.id)}
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
