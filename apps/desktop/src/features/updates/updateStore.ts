import { create } from "zustand";

import { toast } from "@roost/ui";
import { type UpdateInfo, toAppError, updateCheck, updateInstall } from "../../ipc";

/** `startup` stays quiet unless an update is found; `manual` reports every outcome. */
export type CheckMode = "startup" | "manual";

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; update: UpdateInfo }
  | { kind: "installing"; update: UpdateInfo; downloaded: number; total: number | null }
  | { kind: "failed"; update: UpdateInfo; message: string };

type UpdateState = {
  status: UpdateStatus;
  check: (mode: CheckMode) => Promise<void>;
  /** Downloads and installs the found update; the backend restarts the app when it is done. */
  install: () => Promise<void>;
  /** Hides the prompt until the next check. */
  dismiss: () => void;
};

const busy = (status: UpdateStatus): boolean =>
  status.kind === "checking" || status.kind === "installing";

/** Updates from the GitHub release (D-036). */
export const useUpdates = create<UpdateState>()((set, get) => ({
  status: { kind: "idle" },
  check: async (mode) => {
    if (busy(get().status)) return;
    set({ status: { kind: "checking" } });
    try {
      const update = await updateCheck();
      set({ status: update ? { kind: "available", update } : { kind: "idle" } });
      if (!update && mode === "manual") toast.success("Dunlin is up to date");
    } catch (caught) {
      set({ status: { kind: "idle" } });
      // A failed check at startup (offline, no release yet) is logged by the backend only.
      if (mode === "manual") toast.error(toAppError(caught).message);
    }
  },
  install: async () => {
    const status = get().status;
    if (status.kind !== "available" && status.kind !== "failed") return;
    const { update } = status;
    set({ status: { kind: "installing", update, downloaded: 0, total: null } });
    try {
      await updateInstall(({ downloaded, total }) => {
        set({ status: { kind: "installing", update, downloaded, total } });
      });
    } catch (caught) {
      set({ status: { kind: "failed", update, message: toAppError(caught).message } });
    }
  },
  dismiss: () => {
    if (!busy(get().status)) set({ status: { kind: "idle" } });
  },
}));
