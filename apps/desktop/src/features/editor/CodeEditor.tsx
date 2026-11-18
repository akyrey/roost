import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { useEffect, useRef } from "react";

import { useEditorAppearance } from "./appearance";
import { type CodeLanguage, LANGUAGES } from "./languages";

type Props = {
  initialText: string;
  label: string;
  language: CodeLanguage;
  wrap: boolean;
  invalid: boolean;
  onChange: (text: string) => void;
};

const invalidAttribute = (invalid: boolean) =>
  EditorView.contentAttributes.of({ "aria-invalid": String(invalid) });

/** Highlighted, editable text: the cell viewer's editor for JSON, XML and long text.
 * Uncontrolled: it starts from `initialText` and reports every change. */
export function CodeEditor({ initialText, label, language, wrap, invalid, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const appearance = useEditorAppearance();
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
          LANGUAGES[language](),
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
  }, [label, language, wrap, appearance]);

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
