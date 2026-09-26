import type { JobStatus } from "@/types/dashboard";

const STATUS_STYLES: Record<JobStatus, string> = {
  completed:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
  failed: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20",
  running: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20",
};

const ACTIVE_STATUSES = new Set<JobStatus>(["pending", "running"]);

export function StatusBadge({ status, testId }: { status: JobStatus; testId?: string }) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {ACTIVE_STATUSES.has(status) && (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
        </span>
      )}
      {status}
    </span>
  );
}
