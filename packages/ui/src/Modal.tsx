import type { ReactNode } from "react";

export type ModalSize = "medium" | "wide";

const WIDTH_CLASS: Record<ModalSize, string> = {
  medium: "w-[32rem]",
  wide: "w-[56rem]",
};

type Props = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  /** `medium` (default) suits forms; `wide` suits tables and side-by-side panes. */
  size?: ModalSize;
};

export function Modal({ title, children, onClose, footer, size = "medium" }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${WIDTH_CLASS[size]} max-w-[90vw] rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl`}
      >
        <header className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold">
          {title}
        </header>
        <div className="px-4 py-4">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-zinc-800 px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
