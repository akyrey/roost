import { createShortcutRegistry, formatBinding, matchesBinding } from "./registry";

const keys = (
  key: string,
  mods: Partial<Record<"meta" | "ctrl" | "alt" | "shift", boolean>> = {},
  code = "",
) => ({
  key,
  code,
  metaKey: mods.meta ?? false,
  ctrlKey: mods.ctrl ?? false,
  altKey: mods.alt ?? false,
  shiftKey: mods.shift ?? false,
});

const registry = createShortcutRegistry(
  [
    { id: "open", group: "General", description: "Open", keys: ["Mod-o"] },
    { id: "next", group: "Tabs", description: "Next", keys: ["Ctrl-Tab", "Mod-Alt-ArrowRight"] },
    { id: "send", group: "Editor", description: "Send", keys: ["Mod-Enter"] },
  ] as const,
  ["open", "next"],
);

describe("createShortcutRegistry", () => {
  it("matches only the window-level shortcuts", () => {
    expect(registry.matchShortcut(keys("o", { meta: true }), true)).toBe("open");
    expect(registry.matchShortcut(keys("Tab", { ctrl: true }), true)).toBe("next");
    expect(registry.matchShortcut(keys("Enter", { meta: true }), true)).toBeNull();
  });

  it("looks up keys and the first binding, empty for an unknown id", () => {
    expect(registry.keysOf("next")).toEqual(["Ctrl-Tab", "Mod-Alt-ArrowRight"]);
    expect(registry.bindingOf("send")).toBe("Mod-Enter");
    expect(registry.bindingOf("missing" as "send")).toBe("");
  });

  it("labels every alternative the platform's way", () => {
    expect(registry.shortcutLabel("next", true)).toBe("⌃Tab or ⌘⌥→");
    expect(registry.shortcutLabel("next", false)).toBe("Ctrl+Tab or Ctrl+Alt+→");
  });

  it("refuses duplicate ids", () => {
    expect(() =>
      createShortcutRegistry(
        [
          { id: "a", group: "G", description: "A", keys: ["Mod-a"] },
          { id: "a", group: "G", description: "B", keys: ["Mod-b"] },
        ],
        [],
      ),
    ).toThrow("Duplicate shortcut id: a");
  });
});

describe("formatBinding", () => {
  it.each([
    ["Mod-t", true, "⌘T"],
    ["Mod-t", false, "Ctrl+T"],
    ["Mod-Shift-Enter", false, "Ctrl+Shift+↩"],
    ["Mod-Backspace", true, "⌘⌫"],
    ["Escape", true, "Esc"],
    ["Hyper-x", false, "Hyper+X"],
  ])("%s on mac=%s is %s", (binding, mac, label) => {
    expect(formatBinding(binding, mac)).toBe(label);
  });
});

describe("matchesBinding", () => {
  it("needs exactly the binding's modifiers", () => {
    expect(matchesBinding(keys("Enter", { meta: true }), "Mod-Enter", true)).toBe(true);
    expect(matchesBinding(keys("Enter", { meta: true, shift: true }), "Mod-Enter", true)).toBe(
      false,
    );
    expect(matchesBinding(keys("Enter", { ctrl: true }), "Mod-Enter", false)).toBe(true);
  });

  it("reads the physical key when Option or Shift change the character", () => {
    expect(matchesBinding(keys("®", { meta: true, alt: true }, "KeyR"), "Mod-Alt-r", true)).toBe(
      true,
    );
    expect(
      matchesBinding(keys("?", { meta: true, shift: true }, "Slash"), "Mod-Shift-/", true),
    ).toBe(true);
    expect(matchesBinding(keys("!", { shift: true }, "Digit1"), "Shift-1", true)).toBe(true);
  });
});
