import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import type { Extension } from "@codemirror/state";
import { useEditorSettings } from "@roost/ui";
import { useMemo } from "react";

import { themeExtension } from "./theme";

/** A language by name. Apps add their own through a `languages` prop (Dunlin adds `sql`);
 * unknown names are plain text. */
export type CodeLanguage = string;

/** Extra languages; keep the object stable (a module constant) or editors are rebuilt. */
export type LanguageSet = Readonly<Record<string, () => Extension>>;

/** The languages every app gets. */
export const BUILTIN_LANGUAGES: LanguageSet = {
  json: () => json(),
  xml: () => xml(),
  text: () => [],
};

const plainText = (): Extension => [];

/** The CodeMirror theme for the current settings; a new value whenever they change. */
export function useEditorAppearance(): Extension {
  const { theme, font } = useEditorSettings();
  const { family, size } = font;
  return useMemo(() => themeExtension(theme, { family, size }), [theme, family, size]);
}

/** The extension for `language`: the app's, else a built-in one, else plain text. */
export function languageFor(language: CodeLanguage, extra?: LanguageSet): () => Extension {
  return extra?.[language] ?? BUILTIN_LANGUAGES[language] ?? plainText;
}
