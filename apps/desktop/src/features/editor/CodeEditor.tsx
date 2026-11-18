import { CodeEditor as KitCodeEditor } from "@roost/editor";
import type { ComponentProps } from "react";

import { type CodeLanguage, LANGUAGES } from "./languages";

type Props = Omit<ComponentProps<typeof KitCodeEditor>, "languages" | "language"> & {
  language: CodeLanguage;
};

/** Highlighted, editable text: the cell viewer's editor for JSON, XML and long text. */
export function CodeEditor(props: Props) {
  return <KitCodeEditor {...props} languages={LANGUAGES} />;
}
