import { EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { useEffect, useRef } from "react";

import { type CodeLanguage, type LanguageSet, languageFor, useEditorAppearance } from "./settings";

type Props = {
  text: string;
  label: string;
  language: CodeLanguage;
  wrap?: boolean;
  /** The app's languages beyond the built-in ones. */
  languages?: LanguageSet;
};

/** Highlighted text that cannot be edited. */
export function ReadOnlyCode({ text, label, language, wrap = false, languages }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const appearance = useEditorAppearance();
  const languageExtension = languageFor(language, languages);

  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: text,
        extensions: [
          basicSetup,
          appearance,
          languageExtension(),
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
  }, [text, label, languageExtension, wrap, appearance]);

  return <div ref={host} className="h-full overflow-hidden" />;
}
