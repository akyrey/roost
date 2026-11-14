/** Placeholder bars while a panel loads (task 8.11). Hidden from screen readers, which get
 * `label` instead. */
export function Skeleton({ rows = 3, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2 p-3">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-3 animate-pulse rounded bg-zinc-800"
          style={{ width: `${90 - ((i * 23) % 40)}%` }}
        />
      ))}
    </div>
  );
}
