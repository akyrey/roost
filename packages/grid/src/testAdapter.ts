/** A small adapter for tests: values are strings or null, columns say how they are edited. */
import type { CellAdapter, GridColumnBase } from "./types";

export type TestColumn = GridColumnBase & { kind: string };
export type TestValue = string | null;

export const testCells: CellAdapter<TestValue, TestColumn> = {
  present: (value) =>
    value === null
      ? { kind: "null", text: "null", cut: false, alignRight: false }
      : { kind: "text", text: value, cut: false, alignRight: /^\d+$/.test(value) },
  widthText: (value) => value ?? "",
  copyText: (value) => value,
  header: (column) => ({ detail: column.kind, badges: [] }),
};
