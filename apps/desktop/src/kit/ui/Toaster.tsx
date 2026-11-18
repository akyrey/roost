import { type ToastKind, useToasts } from "./toastStore";

const STYLE: Record<ToastKind, string> = {
  success: "border-emerald-800 bg-emerald-950 text-emerald-200",
  info: "border-zinc-700 bg-zinc-800 text-zinc-100",
  error: "border-rose-800 bg-rose-950 text-rose-200",
};

/** The toast stack, bottom right. Read by screen readers as it changes. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed bottom-10 right-4 z-[60] flex w-80 flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex items-start gap-2 rounded border px-3 py-2 text-sm shadow-lg ${STYLE[t.kind]}`}
        >
          <span className="flex-1 break-words">{t.message}</span>
          <button
            type="button"
            aria-label="Dismiss"
            className="text-xs opacity-70 hover:opacity-100"
            onClick={() => {
              useToasts.getState().dismiss(t.id);
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
