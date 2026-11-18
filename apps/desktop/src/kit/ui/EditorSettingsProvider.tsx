import type { ReactNode } from "react";

import { type EditorSettings, EditorSettingsContext } from "./editorSettings";

/** Gives every editor below it the app's theme and font. */
export function EditorSettingsProvider({
  settings,
  children,
}: {
  settings: EditorSettings;
  children: ReactNode;
}) {
  return (
    <EditorSettingsContext.Provider value={settings}>{children}</EditorSettingsContext.Provider>
  );
}
