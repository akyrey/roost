import { createUpdateStore } from "@roost/updates";

import { toAppError, updateCheck, updateInstall } from "../../ipc";

export type { CheckMode, UpdateStatus } from "@roost/updates";

/** Updates from the GitHub release (D-036). */
export const useUpdates = createUpdateStore({
  appName: "Dunlin",
  check: updateCheck,
  install: updateInstall,
  describeError: (caught) => toAppError(caught).message,
});
