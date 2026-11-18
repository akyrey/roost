import {
  type GridEditing as KitGridEditing,
  type RowMark as KitRowMark,
  DataGrid as KitDataGrid,
} from "@roost/grid";
import { type ComponentProps, useMemo } from "react";

import type { TypeCategory, Value } from "../../ipc";
import { useSettings } from "../settings/settingsStore";
import { valueCells } from "./valueCells";

export type GridColumn = {
  name: string;
  typeName: string;
  category: TypeCategory;
  primaryKey?: boolean;
  /** The referenced table, when the column is (the first column of) a foreign key. */
  references?: string;
};

export type RowMark = KitRowMark<Value>;
export type GridEditing = KitGridEditing<Value>;

type Props = Omit<ComponentProps<typeof KitDataGrid<Value, GridColumn>>, "cells">;

/** The kit's grid showing database values (task 6.5). */
export function DataGrid(props: Props) {
  const nullText = useSettings((s) => s.settings.nullText);
  const cells = useMemo(() => valueCells(nullText), [nullText]);
  return <KitDataGrid {...props} cells={cells} />;
}
