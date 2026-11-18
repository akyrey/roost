import { act, renderHook } from "@testing-library/react";

import { resolveTheme, useApplyTheme, usePrefersDark } from "./theme";

describe("theme", () => {
  it("follows the system only when the setting says so", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("puts the theme on the document", () => {
    const { rerender } = renderHook(
      ({ theme }) => {
        useApplyTheme(theme);
      },
      { initialProps: { theme: "light" as "light" | "dark" } },
    );
    expect(document.documentElement.dataset.theme).toBe("light");
    rerender({ theme: "dark" });
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("assumes dark without matchMedia, and follows the system's changes", () => {
    const listeners: ((e: { matches: boolean }) => void)[] = [];
    const original = Object.getOwnPropertyDescriptor(window, "matchMedia");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({
        matches: false,
        addEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.push(l),
        removeEventListener: vi.fn(),
      }),
    });
    const { result } = renderHook(() => usePrefersDark());
    expect(result.current).toBe(false);
    act(() => {
      listeners.forEach((l) => {
        l({ matches: true });
      });
    });
    expect(result.current).toBe(true);
    if (original) Object.defineProperty(window, "matchMedia", original);
  });
});
