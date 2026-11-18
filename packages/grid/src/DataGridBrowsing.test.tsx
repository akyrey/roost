import { fireEvent, render, screen } from "@testing-library/react";

import { DataGrid } from "./DataGrid";
import { preview } from "./present";
import { type TestColumn, type TestValue, testCells } from "./testAdapter";

const columns: TestColumn[] = [
  { name: "id", kind: "integer" },
  { name: "name", kind: "text" },
];
const rows: TestValue[][] = [
  ["1", "ada"],
  ["2", "grace"],
  ["3", null],
];

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const cell = (row: number, col: number) =>
  screen.getAllByRole("row")[row + 1]?.querySelector(`[aria-colindex="${col + 2}"]`) as HTMLElement;

describe("DataGrid browsing", () => {
  it("sorts from the headers and shows the sort order", () => {
    const onSort = vi.fn();
    render(
      <DataGrid
        columns={columns}
        rows={rows}
        cells={testCells}
        sort={[
          { column: "id", descending: true },
          { column: "name", descending: false },
        ]}
        onSort={onSort}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "id" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(screen.getByRole("columnheader", { name: "id" })).toHaveTextContent("▼1");
    expect(screen.getByRole("columnheader", { name: "name" })).toHaveTextContent("▲2");
    fireEvent.click(screen.getByRole("button", { name: "Sort by name" }), { shiftKey: true });
    expect(onSort).toHaveBeenCalledWith("name", true);
  });

  it("resizes a column by dragging and auto-sizes it on double-click", () => {
    render(<DataGrid columns={columns} rows={rows} cells={testCells} />);
    const handle = screen.getByRole("separator", { name: "Resize name" });

    fireEvent.pointerDown(handle, { clientX: 100 });
    fireEvent.pointerMove(window, { clientX: 300 });
    fireEvent.pointerUp(window);
    const header = screen.getByRole("columnheader", { name: "name" });
    const dragged = parseFloat(header.style.width);
    fireEvent.doubleClick(handle);

    expect(dragged).toBeGreaterThan(150);
    expect(parseFloat(header.style.width)).toBeLessThan(dragged);
  });

  it("selects rows from the row header and everything from the corner, and clears with Escape", () => {
    const onSelectionChange = vi.fn();
    render(
      <DataGrid
        columns={columns}
        rows={rows}
        cells={testCells}
        rowOffset={10}
        onSelectionChange={onSelectionChange}
      />,
    );

    fireEvent.pointerDown(screen.getByText("12"));
    expect(cell(1, 1)).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("columnheader", { name: "#" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith({ top: 0, bottom: 2, left: 0, right: 1 });
    fireEvent.keyDown(screen.getByRole("grid"), { key: "Escape" });
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  });

  it("selects all with the keys, drags a range, and activates with Enter", () => {
    const onActivate = vi.fn();
    const onSelectionChange = vi.fn();
    render(
      <DataGrid
        columns={columns}
        rows={rows}
        cells={testCells}
        onActivate={onActivate}
        onSelectionChange={onSelectionChange}
      />,
    );
    const grid = screen.getByRole("grid");

    fireEvent.keyDown(grid, { key: "a", ctrlKey: true });
    expect(onSelectionChange).toHaveBeenLastCalledWith({ top: 0, bottom: 2, left: 0, right: 1 });
    fireEvent.pointerDown(cell(0, 0), { button: 0 });
    fireEvent.pointerEnter(cell(1, 1));
    fireEvent.pointerUp(cell(1, 1));
    expect(onSelectionChange).toHaveBeenLastCalledWith({ top: 0, bottom: 1, left: 0, right: 1 });
    fireEvent.keyDown(grid, { key: "Enter" });
    expect(onActivate).toHaveBeenCalledWith({ row: 1, col: 1 });
  });
});

describe("preview", () => {
  it("shows the first line, at most 200 characters", () => {
    expect(preview("one\ntwo", false)).toEqual({ text: "one…", cut: true });
    expect(preview("x".repeat(250), false)).toEqual({ text: `${"x".repeat(200)}…`, cut: true });
    expect(preview("short", false)).toEqual({ text: "short", cut: false });
    expect(preview("short", true)).toEqual({ text: "short…", cut: true });
  });
});
