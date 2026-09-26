import { AlertIcon, DownloadIcon } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import type { ScrapeJobView } from "@/types/dashboard";

export function JobProgressCard({ job }: { job: ScrapeJobView }) {
  return (
    <section
      data-testid="job-progress-card"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">{job.sourceUrl}</span>
        <StatusBadge status={job.status} testId="job-status" />
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-500 ease-out dark:bg-blue-500"
          style={{ width: `${job.progress ?? 0}%` }}
        />
      </div>
      <p className="mt-2 text-xs tabular-nums text-slate-500 dark:text-slate-400">
        {job.pagesProcessed ?? 0}/{job.pagesDiscovered || "?"} pages &middot; {job.productsFound ?? 0} products found
      </p>

      {job.errors && job.errors.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
          {job.errors.map((e, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <AlertIcon className="mt-0.5 shrink-0" />
              {e.message}
            </li>
          ))}
        </ul>
      )}

      {job.status === "completed" && (
        <div className="mt-4 flex gap-2">
          <a
            href={`/api/jobs/${job._id}/export?format=json`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <DownloadIcon />
            Export JSON
          </a>
          <a
            href={`/api/jobs/${job._id}/export?format=csv`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <DownloadIcon />
            Export CSV
          </a>
        </div>
      )}
    </section>
  );
}
