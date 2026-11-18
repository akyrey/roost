import { create } from "zustand";

export type ToastKind = "success" | "info" | "error";

export type Toast = { id: number; kind: ToastKind; message: string };

/** How long a toast stays; errors stay longer so they can be read. */
export const TOAST_MS: Record<ToastKind, number> = { success: 3000, info: 4000, error: 8000 };
/** Older toasts are dropped beyond this. */
const MAX_TOASTS = 4;

type ToastState = {
  toasts: Toast[];
  show: (kind: ToastKind, message: string) => number;
  dismiss: (id: number) => void;
};

let nextId = 1;

/** Short confirmations and failures that need no decision (task 8.11). Errors that need the
 * user to act stay inline, next to what failed. */
export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (kind, message) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, kind, message }].slice(-MAX_TOASTS) });
    setTimeout(() => {
      get().dismiss(id);
    }, TOAST_MS[kind]);
    return id;
  },
  dismiss: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = {
  success: (message: string): number => useToasts.getState().show("success", message),
  info: (message: string): number => useToasts.getState().show("info", message),
  error: (message: string): number => useToasts.getState().show("error", message),
};
