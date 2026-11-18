import { toast } from "@roost/ui";
import { create } from "zustand";

/** A newer version announced by the release server. */
export type UpdateInfo = { version: string; currentVersion: string; notes: string | null };

export type UpdateProgress = { downloaded: number; total: number | null };

/** `startup` stays quiet unless an update is found; `manual` reports every outcome. */
export type CheckMode = "startup" | "manual";

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; update: UpdateInfo }
  | { kind: "installing"; update: UpdateInfo; downloaded: number; total: number | null }
  | { kind: "failed"; update: UpdateInfo; message: string };

export type UpdateState = {
  status: UpdateStatus;
  check: (mode: CheckMode) => Promise<void>;
  /** Downloads and installs the found update; the backend restarts the app when it is done. */
  install: () => Promise<void>;
  /** Hides the prompt until the next check. */
  dismiss: () => void;
};

/** How an app reaches its updater (Tauri's, through the app's IPC wrappers). */
export type UpdateBackend = {
  appName: string;
  check: () => Promise<UpdateInfo | null>;
  /** On success the promise never settles: the app restarts. */
  install: (onProgress: (progress: UpdateProgress) => void) => Promise<void>;
  /** A user-facing message for a failure. */
  describeError: (caught: unknown) => string;
};

const busy = (status: UpdateStatus): boolean =>
  status.kind === "checking" || status.kind === "installing";

/** The update state for one app. */
export function createUpdateStore(backend: UpdateBackend) {
  return create<UpdateState>()((set, get) => ({
    status: { kind: "idle" },
    check: async (mode) => {
      if (busy(get().status)) return;
      set({ status: { kind: "checking" } });
      try {
        const update = await backend.check();
        set({ status: update ? { kind: "available", update } : { kind: "idle" } });
        if (!update && mode === "manual") toast.success(`${backend.appName} is up to date`);
      } catch (caught) {
        set({ status: { kind: "idle" } });
        // A failed check at startup (offline, no release yet) is logged by the backend only.
        if (mode === "manual") toast.error(backend.describeError(caught));
      }
    },
    install: async () => {
      const status = get().status;
      if (status.kind !== "available" && status.kind !== "failed") return;
      const { update } = status;
      set({ status: { kind: "installing", update, downloaded: 0, total: null } });
      try {
        await backend.install(({ downloaded, total }) => {
          set({ status: { kind: "installing", update, downloaded, total } });
        });
      } catch (caught) {
        set({ status: { kind: "failed", update, message: backend.describeError(caught) } });
      }
    },
    dismiss: () => {
      if (!busy(get().status)) set({ status: { kind: "idle" } });
    },
  }));
}

export type UpdateStore = ReturnType<typeof createUpdateStore>;
