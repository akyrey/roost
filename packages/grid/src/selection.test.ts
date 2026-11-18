import { isSelected, navigate, rangeOf, select, selectAll, selectRow } from "./selection";

const bounds = { rows: 10, cols: 5, pageRows: 3 };
const at = (row: number, col: number) => ({ anchor: { row, col }, focus: { row, col } });
const key = (k: string, shiftKey = false, mod = false) => ({ key: k, shiftKey, mod });

describe("selection", () => {
  it("moves with arrows, Home/End, PageUp/Down and clamps at the edges", () => {
    expect(navigate(at(0, 0), key("ArrowDown"), bounds)?.focus).toEqual({ row: 1, col: 0 });
    expect(navigate(at(0, 0), key("ArrowUp"), bounds)?.focus).toEqual({ row: 0, col: 0 });
    expect(navigate(at(2, 2), key("ArrowRight", false, true), bounds)?.focus).toEqual({
      row: 2,
      col: 4,
    });
    expect(navigate(at(2, 2), key("ArrowLeft", false, true), bounds)?.focus).toEqual({
      row: 2,
      col: 0,
    });
    expect(navigate(at(2, 2), key("ArrowDown", false, true), bounds)?.focus).toEqual({
      row: 9,
      col: 2,
    });
    expect(navigate(at(2, 2), key("ArrowUp", false, true), bounds)?.focus).toEqual({
      row: 0,
      col: 2,
    });
    expect(navigate(at(2, 2), key("Home"), bounds)?.focus).toEqual({ row: 2, col: 0 });
    expect(navigate(at(2, 2), key("End", false, true), bounds)?.focus).toEqual({ row: 9, col: 4 });
    expect(navigate(at(2, 2), key("Home", false, true), bounds)?.focus).toEqual({ row: 0, col: 0 });
    expect(navigate(at(2, 2), key("End"), bounds)?.focus).toEqual({ row: 2, col: 4 });
    expect(navigate(at(8, 1), key("PageDown"), bounds)?.focus).toEqual({ row: 9, col: 1 });
    expect(navigate(at(8, 1), key("PageUp"), bounds)?.focus).toEqual({ row: 5, col: 1 });
    expect(navigate(null, key("ArrowRight"), bounds)?.focus).toEqual({ row: 0, col: 1 });
    expect(navigate(at(0, 0), key("x"), bounds)).toBeUndefined();
    expect(navigate(null, key("ArrowDown"), { ...bounds, rows: 0 })).toBeUndefined();
  });

  it("extends a range with shift and selects rows and everything", () => {
    const extended =
      navigate(
        navigate(at(1, 1), key("ArrowDown", true), bounds) ?? null,
        key("ArrowRight", true),
        bounds,
      ) ?? null;
    const range = rangeOf(extended);

    expect(range).toEqual({ top: 1, bottom: 2, left: 1, right: 2 });
    expect(isSelected(range, 2, 2)).toBe(true);
    expect(isSelected(range, 3, 2)).toBe(false);
    expect(rangeOf(select({ row: 0, col: 0 }, true, extended))).toEqual({
      top: 0,
      bottom: 1,
      left: 0,
      right: 1,
    });
    expect(rangeOf(selectRow(4, 5, false, null))).toEqual({ top: 4, bottom: 4, left: 0, right: 4 });
    expect(rangeOf(selectRow(6, 5, true, at(4, 2)))).toEqual({
      top: 4,
      bottom: 6,
      left: 0,
      right: 4,
    });
    expect(rangeOf(selectAll(bounds))).toEqual({ top: 0, bottom: 9, left: 0, right: 4 });
    expect(selectAll({ ...bounds, rows: 0 })).toBeNull();
    expect(rangeOf(null)).toBeNull();
  });
});
