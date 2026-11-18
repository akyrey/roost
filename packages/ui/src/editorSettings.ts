import { createContext, useContext } from "react";

/** What editors look like, as plain data: no CodeMirror here, so the app can provide it at the
 * root without loading the editor (which @roost/editor loads on first use). */
export type EditorSettings = {
  theme: "dark" | "light";
  font: { family: string; size: number };
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  theme: "dark",
  font: { family: "ui-monospace, SFMono-Regular, Menlo, monospace", size: 13 },
};

export const EditorSettingsContext = createContext<EditorSettings>(DEFAULT_EDITOR_SETTINGS);

export function useEditorSettings(): EditorSettings {
  return useContext(EditorSettingsContext);
}
