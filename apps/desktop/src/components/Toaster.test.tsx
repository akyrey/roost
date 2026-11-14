import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { copyWithToast } from "../lib/copy";
import { Toaster } from "./Toaster";
import { TOAST_MS, toast, useToasts } from "./toastStore";

beforeEach(() => {
  useToasts.setState({ toasts: [] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("toasts", () => {
  it("shows a toast, dismisses it on click and keeps at most four", async () => {
    render(<Toaster />);
    act(() => {
      for (const n of [1, 2, 3, 4, 5]) toast.info(`note ${n}`);
    });

    expect(screen.getAllByRole("status").map((s) => s.textContent)).toEqual([
      "note 2✕",
      "note 3✕",
      "note 4✕",
      "note 5✕",
    ]);
    await userEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0] as HTMLElement);
    expect(screen.queryByText("note 2")).toBeNull();
  });

  it("goes away by itself, errors later than confirmations", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast.success("done");
      toast.error("failed");
    });

    act(() => {
      vi.advanceTimersByTime(TOAST_MS.success);
    });
    expect(screen.queryByText("done")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("failed");
    act(() => {
      vi.advanceTimersByTime(TOAST_MS.error);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("confirms a copy, or explains a refused one", async () => {
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("no"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<Toaster />);

    await act(() => copyWithToast("x", "the value"));
    await act(() => copyWithToast("y", "the value"));

    expect(screen.getByRole("status")).toHaveTextContent("Copied the value");
    expect(screen.getByRole("alert")).toHaveTextContent("The clipboard refused the copy");
  });
});
