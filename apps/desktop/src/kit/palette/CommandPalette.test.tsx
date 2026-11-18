import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CommandPalette, type PaletteItem } from "./CommandPalette";

const item = (id: string, extra: Partial<PaletteItem> = {}): PaletteItem => ({
  id,
  group: "Actions",
  label: id,
  run: vi.fn(),
  ...extra,
});

describe("CommandPalette", () => {
  it("filters, moves with the arrows and runs the chosen item", async () => {
    const items = [item("New request"), item("New folder"), item("Settings")];
    const onClose = vi.fn();
    render(<CommandPalette commands={items} onClose={onClose} />);

    const input = screen.getByRole("combobox", { name: "Search commands" });
    await userEvent.type(input, "new");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "ActionsNew request",
      "ActionsNew folder",
    ]);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}{Enter}");
    expect(onClose).toHaveBeenCalled();
    expect(items[1]?.run).toHaveBeenCalled();
  });

  it("shows a hint before a detail, and says when nothing matches", async () => {
    render(
      <CommandPalette
        placeholder="Search everything"
        commands={[
          item("Send", { hint: "⌘↩", detail: "request" }),
          item("Open", { detail: "file" }),
        ]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("⌘↩")).toBeInTheDocument();
    expect(screen.queryByText("request")).toBeNull();
    expect(screen.getByText("file")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("combobox", { name: "Search everything" }), "zzz");
    expect(screen.getByText("No matches.")).toBeInTheDocument();
  });

  it("closes on Escape and on a click outside", async () => {
    const onClose = vi.fn();
    const { container } = render(<CommandPalette commands={[]} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    await userEvent.pointer({
      keys: "[MouseLeft>]",
      target: container.firstElementChild as Element,
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
