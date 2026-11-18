import { Button } from "./Button";
import { Modal } from "./Modal";

type Props = {
  title: string;
  message: string;
  detail?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  message,
  detail,
  confirmLabel,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel} autoFocus>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-zinc-200">{message}</p>
      {detail && (
        <pre className="mt-3 max-h-40 overflow-auto rounded bg-zinc-950 p-2 font-mono text-xs text-zinc-300">
          {detail}
        </pre>
      )}
    </Modal>
  );
}
