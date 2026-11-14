import { json } from "@codemirror/lang-json";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { useEffect, useRef } from "react";

import { themeExtension } from "./theme";

export type CodeLanguage = "sql" | "json" | "xml" | "text";

const LANGUAGES: Record<CodeLanguage, () => Extension> = {
  sql: () => sql(),
  json: () => json(),
  xml: () => xml(),
  text: () => [],
};

type Props = { text: string; label: string; language: CodeLanguage; wrap?: boolean };

/** Highlighted text that cannot be edited: DDL, the JSON view, the cell viewer. */
export function ReadOnlyCode({ text, label, language, wrap = false }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: text,
        extensions: [
          basicSetup,
          themeExtension("dark"),
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
  }, [text, label, language, wrap]);

  return <div ref={host} className="h-full overflow-hidden" />;
}
