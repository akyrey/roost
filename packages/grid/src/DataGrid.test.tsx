import { fireEvent, render, screen, within } from "@testing-library/react";

import { DataGrid } from "./DataGrid";
import type { CellAdapter, GridColumnBase } from "./types";

const clipboardWrite = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: clipboardWrite },
  configurable: true,
});

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
  clipboardWrite.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const cell = (row: number, col: number) =>
  screen.getAllByRole("row")[row + 1]?.querySelector(`[aria-colindex="${col + 2}"]`) as HTMLElement;

type Column = GridColumnBase & { kind: string };
type Json = string | number | null;

/** A JSON-ish adapter, the way Whimbrel shows a response array as a table. */
const cells: CellAdapter<Json, Column> = {
  present: (value) =>
    value === null
      ? { kind: "null", text: "—", cut: false, alignRight: false }
      : typeof value === "number"
        ? { kind: "number", text: String(value), cut: false, alignRight: true }
        : { kind: "text", text: value, cut: false, alignRight: false },
  widthText: (value) => String(value ?? ""),
  copyText: (value) => (value === null ? null : String(value)),
  header: (column) => ({
    detail: column.kind,
    badges: column.references ? [{ text: "LINK", className: "text-sky-300" }] : [],
  }),
};

const columns: Column[] = [
  { name: "id", kind: "number" },
  { name: "owner", kind: "string", references: "users" },
];
const rows: Json[][] = [
  [1, "ada"],
  [2, null],
];

describe("DataGrid with an app's own values", () => {
  it("presents cells, headers and badges through the adapter", () => {
    render(<DataGrid columns={columns} rows={rows} cells={cells} />);

    const header = screen.getByRole("columnheader", { name: "owner" });
    expect(header).toHaveAttribute("title", "owner\nstring");
    expect(within(header).getByText("LINK")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("copies the selection with the adapter's text, empty for no value", () => {
    render(<DataGrid columns={columns} rows={rows} cells={cells} />);

    fireEvent.pointerDown(cell(0, 0), { button: 0 });
    fireEvent.pointerDown(cell(1, 1), { button: 0, shiftKey: true });
    fireEvent.keyDown(screen.getByRole("grid"), { key: "c", ctrlKey: true });
    expect(clipboardWrite).toHaveBeenCalledWith("1\tada\n2\t");
  });

  it("offers the link only on cells with a value", () => {
    render(<DataGrid columns={columns} rows={rows} cells={cells} onFollow={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: "Open the users row" })).toHaveLength(1);
  });
});
