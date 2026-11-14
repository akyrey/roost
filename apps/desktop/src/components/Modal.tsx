import type { ReactNode } from "react";

type Props = { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode };

export function Modal({ title, children, onClose, footer }: Props) {
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
        className="w-[32rem] max-w-[90vw] rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl"
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
