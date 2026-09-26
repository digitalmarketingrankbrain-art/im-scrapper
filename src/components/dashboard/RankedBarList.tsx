import type { NamedCount } from "@/types/dashboard";

export function RankedBarList({ items, tone = "accent" }: { items: NamedCount[]; tone?: "accent" | "critical" }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">No data yet.</p>;
  }

  const max = Math.max(...items.map((item) => item.count));
  const barClass = tone === "critical" ? "bg-rose-500 dark:bg-rose-500" : "bg-blue-600 dark:bg-blue-500";

  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.name} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-slate-600 dark:text-slate-400" title={item.name}>
            {item.name}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full ${barClass}`}
              style={{ width: `${Math.max((item.count / max) * 100, 4)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {item.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
