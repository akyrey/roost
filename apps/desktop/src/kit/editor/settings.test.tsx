import { EditorSettingsProvider } from "@roost/ui";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

import { BUILTIN_LANGUAGES, languageFor, useEditorAppearance } from "./settings";

describe("languageFor", () => {
  it("prefers the app's language, then a built-in one, then plain text", () => {
    const sql = () => [];
    expect(languageFor("sql", { sql })).toBe(sql);
    expect(languageFor("json", { sql })).toBe(BUILTIN_LANGUAGES.json);
    expect(languageFor("cobol")()).toEqual([]);
  });

  it("lets the app override a built-in language", () => {
    const json = () => [];
    expect(languageFor("json", { json })).toBe(json);
  });
});

describe("useEditorAppearance", () => {
  it("is stable while the settings are, and changes with them", () => {
    let settings = { theme: "dark" as const, font: { family: "mono", size: 13 } };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <EditorSettingsProvider settings={settings}>{children}</EditorSettingsProvider>
    );
    const { result, rerender } = renderHook(() => useEditorAppearance(), { wrapper });
    const first = result.current;

    rerender();
    expect(result.current).toBe(first);
    settings = { ...settings, font: { family: "mono", size: 14 } };
    rerender();
    expect(result.current).not.toBe(first);
  });
});
