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
              </div>
              <StatusBadge status={job.status} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
