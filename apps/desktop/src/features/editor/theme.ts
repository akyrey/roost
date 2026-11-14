import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { tags as t } from "@lezer/highlight";
import { EditorView } from "codemirror";

export type EditorThemeName = "dark" | "light";

export type EditorFont = { family: string; size: number };

/** The dark CodeMirror theme shared by every SQL view. */
export const editorTheme = EditorView.theme(
  {
    "&": { height: "100%", backgroundColor: "#18181b", color: "#e4e4e7" },
    ".cm-content": { caretColor: "#e4e4e7" },
    ".cm-gutters": { backgroundColor: "#18181b", color: "#71717a", border: "none" },
    ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "#27272a80" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "#0369a180",
    },
    ".cm-activeStatement": { backgroundColor: "#0ea5e90d" },
    ".cm-statementError": { textDecoration: "underline wavy #f43f5e" },
    ".cm-tooltip": { backgroundColor: "#27272a", border: "1px solid #3f3f46" },
    ".cm-tooltip-autocomplete ul li[aria-selected]": { backgroundColor: "#0369a1" },
  },
  { dark: true },
);

const lightTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "#ffffff", color: "#18181b" },
  ".cm-content": { caretColor: "#18181b" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "#bae6fd",
  },
  ".cm-tooltip": { backgroundColor: "#f4f4f5", border: "1px solid #d4d4d8" },
  ".cm-tooltip-autocomplete ul li[aria-selected]": { backgroundColor: "#bae6fd", color: "#18181b" },
  ".cm-gutters": { backgroundColor: "#ffffff", color: "#a1a1aa", border: "none" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "#f4f4f5" },
  ".cm-activeStatement": { backgroundColor: "#0ea5e914" },
  ".cm-statementError": { textDecoration: "underline wavy #e11d48" },
});

const darkHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "#c084fc" },
  { tag: t.string, color: "#86efac" },
  // lang-sql tags quoted identifiers ("name", `name`) as special strings.
  { tag: t.special(t.string), color: "#7dd3fc" },
  { tag: [t.number, t.bool, t.null], color: "#fbbf24" },
  { tag: [t.lineComment, t.blockComment], color: "#71717a", fontStyle: "italic" },
  { tag: [t.special(t.name), t.standard(t.name)], color: "#5eead4" },
  { tag: t.typeName, color: "#f9a8d4" },
  { tag: t.operator, color: "#a1a1aa" },
]);

const lightHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "#7e22ce" },
  { tag: t.string, color: "#15803d" },
  { tag: t.special(t.string), color: "#0369a1" },
  { tag: [t.number, t.bool, t.null], color: "#b45309" },
  { tag: [t.lineComment, t.blockComment], color: "#71717a", fontStyle: "italic" },
  { tag: [t.special(t.name), t.standard(t.name)], color: "#0f766e" },
  { tag: t.typeName, color: "#be185d" },
]);

const fontTheme = (font: EditorFont) =>
  EditorView.theme({
    "&": { fontSize: `${font.size}px` },
    ".cm-content, .cm-gutters, .cm-tooltip": { fontFamily: font.family },
  });

/** Colours, syntax highlighting and the editor font from the settings (task 8.8). */
export function themeExtension(name: EditorThemeName, font: EditorFont): Extension {
  const colours =
    name === "dark"
      ? [editorTheme, syntaxHighlighting(darkHighlight)]
      : [lightTheme, syntaxHighlighting(lightHighlight)];
  return [colours, fontTheme(font)];
}
