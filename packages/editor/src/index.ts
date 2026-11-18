// @roost/editor: CodeMirror editors with the shared theme. Heavy: import it from code that is
// loaded on first use. The theme and font come from EditorSettingsProvider in @roost/ui.
export { CodeEditor } from "./CodeEditor";
export { ReadOnlyCode } from "./ReadOnlyCode";
export {
  BUILTIN_LANGUAGES,
  type CodeLanguage,
  type LanguageSet,
  languageFor,
  useEditorAppearance,
} from "./settings";
export { type EditorFont, type EditorThemeName, editorTheme, themeExtension } from "./theme";
