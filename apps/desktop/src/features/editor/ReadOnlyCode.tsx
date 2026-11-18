import { EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { useEffect, useRef } from "react";

import { useEditorAppearance } from "./appearance";
import { type CodeLanguage, LANGUAGES } from "./languages";

export type { CodeLanguage } from "./languages";

type Props = { text: string; label: string; language: CodeLanguage; wrap?: boolean };

/** Highlighted text that cannot be edited: DDL, the JSON view, the cell viewer. */
export function ReadOnlyCode({ text, label, language, wrap = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const appearance = useEditorAppearance();

  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: text,
        extensions: [
          basicSetup,
          appearance,
          LANGUAGES[language](),
          wrap ? EditorView.lineWrapping : [],
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorView.contentAttributes.of({ "aria-label": label }),
        ],
      }),
    });
    return () => {
      view.destroy();
    };
  }, [text, label, language, wrap, appearance]);

  return <div ref={host} className="h-full overflow-hidden" />;
}
