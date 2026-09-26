import type { JobStatus } from "@/types/dashboard";

const STATUS_ORDER: JobStatus[] = ["completed", "running", "pending", "failed", "cancelled"];

const STATUS_DOT: Record<JobStatus, string> = {
  completed: "bg-emerald-500",
  running: "bg-amber-500",
  pending: "bg-amber-500",
  failed: "bg-rose-500",
  cancelled: "bg-rose-400",
};

export function JobStatusBreakdown({ byStatus }: { byStatus: Record<JobStatus, number> }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {STATUS_ORDER.map((status) => (
        <li
          key={status}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
        >
          <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[status]}`} />
          <span className="truncate text-xs capitalize text-slate-500 dark:text-slate-400">{status}</span>
          <span className="ml-auto text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            {byStatus[status]}
          </span>
        </li>
      ))}
    </ul>
  );
}
