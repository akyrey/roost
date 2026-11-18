import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ConfirmDialog } from "./ConfirmDialog";
import { ContextMenu } from "./ContextMenu";
import { Modal } from "./Modal";
import { SidebarResizer } from "./SidebarResizer";
import { Skeleton } from "./Skeleton";

describe("Modal and ConfirmDialog", () => {
  it("closes on Escape from inside", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Settings" onClose={onClose} footer={<button type="button">Done</button>}>
        <p>body</p>
      </Modal>,
    );

    expect(screen.getByRole("dialog", { name: "Settings" })).toHaveTextContent("body");
    fireEvent.keyDown(screen.getByRole("button", { name: "Done" }), { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Done" }), { key: "Enter" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("confirms or cancels", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Delete request?"
        message="It is removed from the collection."
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("ContextMenu", () => {
  it("focuses the first item, runs a chosen item and closes", async () => {
    const rename = vi.fn();
    const onClose = vi.fn();
    render(
      <ContextMenu
        label="Request actions"
        x={10}
        y={20}
        items={[
          { label: "Rename", onSelect: rename },
          { label: "Delete", onSelect: vi.fn(), destructive: true },
        ]}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveClass("text-rose-300");
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(rename).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and on a click outside", () => {
    const onClose = vi.fn();
    render(
      <ContextMenu
        label="Menu"
        x={0}
        y={0}
        items={[{ label: "A", onSelect: vi.fn() }]}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(document.body);
    fireEvent.mouseDown(screen.getByRole("menuitem", { name: "A" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("SidebarResizer and Skeleton", () => {
  it("resizes with the arrows and by dragging", () => {
    const onResize = vi.fn();
    render(<SidebarResizer width={200} min={100} max={400} onResize={onResize} />);
    const handle = screen.getByRole("separator", { name: "Resize the sidebar" });

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "a" });
    fireEvent.pointerDown(handle, { clientX: 50 });
    fireEvent.pointerMove(window, { clientX: 80 });
    fireEvent.pointerUp(window);

    expect(onResize.mock.calls).toEqual([[216], [184], [230]]);
    expect(handle).toHaveAttribute("aria-valuemax", "400");
  });

  it("announces what is loading", () => {
    render(<Skeleton rows={2} label="Loading the spec" />);
    expect(screen.getByRole("status", { name: "Loading the spec" })).toBeInTheDocument();
  });
});
