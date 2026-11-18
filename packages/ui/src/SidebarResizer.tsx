import type { KeyboardEvent, PointerEvent } from "react";

const KEY_STEP = 16;

type Props = {
  width: number;
  /** For assistive technology; the caller clamps the width it is given. */
  min: number;
  max: number;
  onResize: (width: number) => void;
};

/** The draggable edge of the sidebar; arrow keys resize it too. */
export function SidebarResizer({ width, min, max, onResize }: Props) {
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const onMove = (e: globalThis.PointerEvent) => {
      onResize(width + e.clientX - startX);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -KEY_STEP, ArrowRight: KEY_STEP }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    onResize(width + step);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the sidebar"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={width}
      tabIndex={0}
      className="w-1 shrink-0 cursor-col-resize bg-zinc-800 hover:bg-sky-700 focus:bg-sky-700 focus:outline-none"
      onPointerDown={startDrag}
      onKeyDown={onKeyDown}
    />
  );
}
