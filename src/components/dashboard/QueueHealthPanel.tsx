import { AlertIcon } from "@/components/icons";
import type { QueueCounts } from "@/types/dashboard";

const QUEUE_FIELDS: { key: keyof QueueCounts; label: string; tone: string }[] = [
  { key: "waiting", label: "Waiting", tone: "text-slate-700 dark:text-slate-300" },
  { key: "active", label: "Active", tone: "text-amber-600 dark:text-amber-400" },
  { key: "completed", label: "Completed", tone: "text-emerald-600 dark:text-emerald-400" },
  { key: "failed", label: "Failed", tone: "text-rose-600 dark:text-rose-400" },
  { key: "delayed", label: "Delayed", tone: "text-slate-700 dark:text-slate-300" },
];

export function QueueHealthPanel({ queue }: { queue: QueueCounts | null }) {
  if (!queue) {
    return (
      <p className="flex items-start gap-1.5 text-sm text-slate-500 dark:text-slate-400">
        <AlertIcon className="mt-0.5 shrink-0" />
        Queue unreachable — check that Redis and the worker are running.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {QUEUE_FIELDS.map(({ key, label, tone }) => (
        <div key={key} className="rounded-lg border border-slate-200 px-3 py-2 text-center dark:border-slate-800">
          <p className={`text-lg font-semibold tabular-nums ${tone}`}>{queue[key]}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        </div>
      ))}
    </div>
  );
}
