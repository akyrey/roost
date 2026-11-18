import { ReadOnlyCode as KitReadOnlyCode } from "@roost/editor";
import type { ComponentProps } from "react";

import { type CodeLanguage, LANGUAGES } from "./languages";

export type { CodeLanguage } from "./languages";

type Props = Omit<ComponentProps<typeof KitReadOnlyCode>, "languages" | "language"> & {
  language: CodeLanguage;
};

/** Highlighted text that cannot be edited: DDL, the JSON view, the cell viewer. */
export function ReadOnlyCode(props: Props) {
  return <KitReadOnlyCode {...props} languages={LANGUAGES} />;
}
