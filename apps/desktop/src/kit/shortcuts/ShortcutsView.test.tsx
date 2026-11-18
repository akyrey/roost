import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createShortcutRegistry } from "./registry";
import { ShortcutsView } from "./ShortcutsView";

const registry = createShortcutRegistry(
  [
    { id: "open", group: "General", description: "Open a file", keys: ["Mod-o"] },
    { id: "send", group: "Editor", description: "Send the request", keys: ["Mod-Enter"] },
  ] as const,
  [],
);

it("lists the shortcuts by group, in the given group order, and closes", async () => {
  const onClose = vi.fn();
  render(<ShortcutsView registry={registry} groups={["Editor", "General"]} onClose={onClose} />);

  const sections = screen.getAllByRole("region");
  expect(sections.map((s) => s.getAttribute("aria-label"))).toEqual(["Editor", "General"]);
  expect(within(sections[0] as HTMLElement).getByText("Send the request")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(onClose).toHaveBeenCalled();
});
