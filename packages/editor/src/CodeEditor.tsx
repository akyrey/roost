import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { useEffect, useRef } from "react";

import { type CodeLanguage, type LanguageSet, languageFor, useEditorAppearance } from "./settings";

type Props = {
  initialText: string;
  /** When given, the editor follows it: a value that differs from the document replaces it as
   * one change, which undo takes back. Echoing the editor's own changes back does nothing. */
  text?: string;
  label: string;
  language: CodeLanguage;
  wrap: boolean;
  invalid: boolean;
  onChange: (text: string) => void;
  /** The app's languages beyond the built-in ones. */
  languages?: LanguageSet;
};

const invalidAttribute = (invalid: boolean) =>
  EditorView.contentAttributes.of({ "aria-invalid": String(invalid) });

/** Highlighted, editable text.
 * Starts from `initialText` and reports every change; pass `text` to set it from outside too. */
export function CodeEditor({
  initialText,
  text: outside,
  label,
  language,
  wrap,
  invalid,
  onChange,
  languages,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const appearance = useEditorAppearance();
  const languageExtension = languageFor(language, languages);
  // Kept across rebuilds (a wrap or theme change) so the edit is never lost.
  const text = useRef(initialText);
  const changed = useRef(onChange);
  const invalidNow = useRef(invalid);
  const validity = useRef(new Compartment());

  useEffect(() => {
    changed.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!host.current) return;
    const created = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: text.current,
        extensions: [
          basicSetup,
          appearance,
          languageExtension(),
          wrap ? EditorView.lineWrapping : [],
          EditorView.contentAttributes.of({ "aria-label": label }),
          validity.current.of(invalidAttribute(invalidNow.current)),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            text.current = update.state.doc.toString();
            changed.current(text.current);
          }),
        ],
      }),
    });
    view.current = created;
    created.focus();
    return () => {
      view.current = null;
      created.destroy();
    };
  }, [label, languageExtension, wrap, appearance]);

  // Applied as an edit, not a rebuild, so the cursor and the undo history survive.
  useEffect(() => {
    const current = view.current;
    if (outside === undefined || !current || outside === current.state.doc.toString()) return;
    current.dispatch({ changes: { from: 0, to: current.state.doc.length, insert: outside } });
  }, [outside]);

  // Reconfigured in place: rebuilding the editor would lose the cursor.
  useEffect(() => {
    invalidNow.current = invalid;
    view.current?.dispatch({ effects: validity.current.reconfigure(invalidAttribute(invalid)) });
  }, [invalid]);

  return (
    <div
      ref={host}
      className={`min-h-0 flex-1 overflow-hidden rounded outline outline-1 ${invalid ? "outline-rose-500" : "outline-zinc-700"}`}
    />
  );
}
