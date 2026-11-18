import { Button, Modal } from "@roost/ui";

import type { UpdateStore } from "./updateStore";

const MEGABYTE = 1024 * 1024;

function progressText(downloaded: number, total: number | null): string {
  if (total !== null && total > 0) {
    return `Downloading… ${String(Math.min(100, Math.round((downloaded / total) * 100)))}%`;
  }
  return `Downloading… ${(downloaded / MEGABYTE).toFixed(1)} MB`;
}

type Props = {
  appName: string;
  useUpdates: UpdateStore;
  /** What the restart will lose, if anything; asked when the prompt shows. */
  unsavedWarning?: () => string | null;
};

/** Offers a found update, and shows the download until the app restarts. */
export function UpdatePrompt({ appName, useUpdates, unsavedWarning }: Props) {
  const status = useUpdates((s) => s.status);
  if (status.kind !== "available" && status.kind !== "installing" && status.kind !== "failed") {
    return null;
  }
  const { update } = status;
  const installing = status.kind === "installing";
  const { install, dismiss } = useUpdates.getState();
  const lost = unsavedWarning?.() ?? null;

  return (
    <Modal
      title="Update available"
      onClose={dismiss}
      footer={
        <>
          <Button onClick={dismiss} disabled={installing} autoFocus>
            Later
          </Button>
          <Button variant="primary" onClick={() => void install()} disabled={installing}>
            {status.kind === "failed" ? "Try again" : "Install and restart"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-zinc-200">
        {appName} {update.version} is available. You have {update.currentVersion}.
      </p>
      {update.notes && (
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-zinc-950 p-2 text-xs text-zinc-300">
          {update.notes}
        </pre>
      )}
      {lost && !installing && (
        <p className="mt-3 text-xs text-amber-300">
          {appName} restarts after the install. {lost}
        </p>
      )}
      {installing && (
        <p role="status" className="mt-3 text-xs text-zinc-400">
          {progressText(status.downloaded, status.total)}
        </p>
      )}
      {status.kind === "failed" && (
        <p role="alert" className="mt-3 text-xs text-rose-300">
          {status.message}
        </p>
      )}
    </Modal>
  );
}
