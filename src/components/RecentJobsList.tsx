"use client";

import { StatusBadge } from "@/components/StatusBadge";
import type { ScrapeJobView } from "@/types/dashboard";

interface RecentJobsListProps {
  jobs: ScrapeJobView[];
  onSelect: (job: ScrapeJobView) => void;
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RecentJobsList({ jobs, onSelect }: RecentJobsListProps) {
  if (jobs.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Recent jobs</h2>
      <ul
        data-testid="recent-jobs-list"
        className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900"
      >
        {jobs.map((job) => (
          <li key={job._id}>
            <button
              onClick={() => onSelect(job)}
              data-testid="recent-job-item"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <div className="min-w-0">
                <p className="truncate text-slate-700 dark:text-slate-300">{job.sourceUrl}</p>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{formatTimestamp(job.createdAt)}</p>
                {job.status === "running" && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${job.progress ?? 0}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {Math.round(job.progress ?? 0)}% · {job.productsProcessed ?? 0}/{job.productsFound ?? 0} products
                    </span>
                  </div>
                )}
              </div>
              <StatusBadge status={job.status} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
