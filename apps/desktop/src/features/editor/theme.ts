import { EditorView } from "codemirror";

/** The dark CodeMirror theme shared by every SQL view. */
export const editorTheme = EditorView.theme(
  {
    "&": { height: "100%", fontSize: "13px", backgroundColor: "#18181b", color: "#e4e4e7" },
    ".cm-content": {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      caretColor: "#e4e4e7",
    },
    ".cm-gutters": { backgroundColor: "#18181b", color: "#71717a", border: "none" },
    ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "#27272a80" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "#0369a180",
    },
  },
  { dark: true },
);
