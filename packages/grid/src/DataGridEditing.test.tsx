import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DataGrid } from "./DataGrid";
import { type TestColumn, type TestValue, testCells } from "./testAdapter";
import type { EditorKind, GridEditing, RowMark } from "./types";

const columns: TestColumn[] = [
  { name: "id", kind: "integer" },
  { name: "flag", kind: "bool" },
  { name: "doc", kind: "json" },
  { name: "photo", kind: "binary" },
];
const rows: TestValue[][] = [
  ["1", "true", "{}", ""],
  ["2", "false", "[]", null],
];
const KINDS: EditorKind[] = ["number", "bool", "long", "binary"];

function editing(overrides: Partial<GridEditing<TestValue>> = {}): GridEditing<TestValue> {
  return {
    mark: (row): RowMark<TestValue> => ({
      inserted: row === 1,
      deleted: false,
      edited: row === 0 ? ["id"] : [],
      originals: row === 0 ? { id: "9" } : {},
      failed: false,
    }),
    kind: (cell) => KINDS[cell.col] ?? "none",
    initialText: (cell) => rows[cell.row]?.[cell.col] ?? "",
    parse: (_cell, text) =>
      /^\d+$/.test(text) ? { value: text } : { error: "Enter a whole number" },
    hint: () => undefined,
    onCommit: vi.fn(),
    onToggle: vi.fn(),
    onEditLong: vi.fn(),
    onSetNull: vi.fn(),
    onDeleteRows: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const cell = (row: number, col: number) =>
  screen.getAllByRole("row")[row + 1]?.querySelector(`[aria-colindex="${col + 2}"]`) as HTMLElement;

describe("DataGrid editing", () => {
  it("marks edited cells with their original value, and inserted and failed rows", () => {
    const edit = editing({
      mark: (row): RowMark<TestValue> => ({
        inserted: row === 1,
        deleted: false,
        edited: row === 0 ? ["id"] : [],
        originals: row === 0 ? { id: "9" } : {},
        failed: row === 0,
      }),
    });
    render(<DataGrid columns={columns} rows={rows} cells={testCells} edit={edit} />);

    expect(cell(0, 0)).toHaveAttribute("data-edited", "true");
    expect(cell(0, 0).title).toContain("Original: 9");
    expect(screen.getAllByRole("row")[1]).toHaveAttribute("data-state", "failed");
    expect(screen.getAllByRole("row")[2]).toHaveAttribute("data-state", "inserted");
  });

  it("edits inline: invalid values stay open, Enter commits and moves down, Escape cancels", async () => {
    const edit = editing();
    render(<DataGrid columns={columns} rows={rows} cells={testCells} edit={edit} />);

    await userEvent.dblClick(cell(0, 0));
    const input = screen.getByLabelText("Edit id");
    await userEvent.clear(input);
    await userEvent.type(input, "x{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a whole number");
    await userEvent.clear(input);
    await userEvent.type(input, "42{Enter}");
    expect(edit.onCommit).toHaveBeenCalledWith({ row: 0, col: 0 }, "42");
    expect(screen.queryByLabelText("Edit id")).toBeNull();

    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "7" });
    const typed = screen.getByLabelText("Edit id");
    expect(typed).toHaveValue("7");
    fireEvent.keyDown(typed, { key: "Escape" });
    expect(screen.queryByLabelText("Edit id")).toBeNull();
    expect(edit.onCommit).toHaveBeenCalledTimes(1);
  });

  it("toggles booleans, sends long values elsewhere, and leaves binary alone", async () => {
    const onActivate = vi.fn();
    const edit = editing();
    render(
      <DataGrid
        columns={columns}
        rows={rows}
        cells={testCells}
        edit={edit}
        onActivate={onActivate}
      />,
    );

    await userEvent.dblClick(cell(0, 1));
    expect(edit.onToggle).toHaveBeenCalledWith({ row: 0, col: 1 });
    await userEvent.dblClick(cell(0, 2));
    expect(edit.onEditLong).toHaveBeenCalledWith({ row: 0, col: 2 });
    await userEvent.dblClick(cell(0, 3));
    expect(onActivate).toHaveBeenCalledWith({ row: 0, col: 3 });
  });

  it("clears values and deletes rows with the keys, and Tab edits across", () => {
    const edit = editing();
    render(<DataGrid columns={columns} rows={rows} cells={testCells} edit={edit} />);
    const grid = screen.getByRole("grid");

    fireEvent.pointerDown(cell(0, 0), { button: 0 });
    fireEvent.pointerDown(cell(1, 1), { button: 0, shiftKey: true });
    fireEvent.keyDown(grid, { key: "Backspace", shiftKey: true, ctrlKey: true });
    expect(edit.onSetNull).toHaveBeenCalledWith([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ]);
    fireEvent.keyDown(grid, { key: "Backspace", ctrlKey: true });
    expect(edit.onDeleteRows).toHaveBeenCalledWith([0, 1]);

    fireEvent.pointerDown(cell(1, 0), { button: 0 });
    fireEvent.keyDown(grid, { key: "F2" });
    fireEvent.keyDown(screen.getByLabelText("Edit id"), { key: "Tab", shiftKey: true });
    expect(edit.onCommit).toHaveBeenCalledWith({ row: 1, col: 0 }, "2");
  });

  it("commits on blur, and does not edit deleted rows", async () => {
    const edit = editing();
    const { unmount } = render(
      <DataGrid columns={columns} rows={rows} cells={testCells} edit={edit} />,
    );
    await userEvent.dblClick(cell(1, 0));
    fireEvent.blur(screen.getByLabelText("Edit id"));
    expect(edit.onCommit).toHaveBeenCalledWith({ row: 1, col: 0 }, "2");
    unmount();

    const deleted = editing({
      mark: () => ({ inserted: false, deleted: true, edited: [], originals: {}, failed: false }),
    });
    render(<DataGrid columns={columns} rows={rows} cells={testCells} edit={deleted} />);
    await userEvent.dblClick(cell(0, 0));
    expect(screen.queryByLabelText("Edit id")).toBeNull();
    expect(screen.getAllByRole("row")[1]).toHaveAttribute("data-state", "deleted");
  });
});
