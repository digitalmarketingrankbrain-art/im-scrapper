import { AlertIcon, DownloadIcon } from "@/components/icons";
import { JobActivity } from "@/components/JobActivity";
import { StatusBadge } from "@/components/StatusBadge";
import type { ScrapeJobView } from "@/types/dashboard";

const ERROR_TYPE_LABELS: Record<string, string> = {
  rate_limited: "Rate limited (429)",
  browser_crash: "Browser crashed",
  timeout: "Timed out",
  network_error: "Network error",
  http_error: "HTTP error",
  access_denied: "Access denied",
  unsupported_page: "Unsupported page",
  validation_error: "Skipped",
  parsing_error: "Parse error",
  unknown_error: "Error",
};

function phaseMessage(job: ScrapeJobView): string | null {
  switch (job.phase) {
    case "discovering":
      return `Step 1/4 · Scanning the site — ${job.pagesProcessed ?? 0} of ${job.pagesDiscovered || "?"} pages found so far`;
    case "scraping":
      return `Step 2/4 · Found ${job.pagesDiscovered} pages and ${job.productsFound} products — saving ${job.productsProcessed ?? 0}/${job.productsFound}`;
    case "verifying":
      return `Step 3/4 · Checking for missed products${job.retryRound ? ` — retry round ${job.retryRound}` : ""}`;
    case "downloading":
      return `Step 4/4 · Downloading images — ${(job.imagesDownloaded ?? 0) + (job.imagesFailed ?? 0)}/${job.imagesTotal ?? "?"}`;
    default:
      return null;
  }
}

export function JobProgressCard({ job }: { job: ScrapeJobView }) {
  const message = phaseMessage(job);
  const showTotals = job.phase && job.phase !== "discovering";
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
          style={{ width: `${job.status === "failed" && !job.productsFound ? 0 : job.progress ?? 0}%` }}
        />
      </div>
      <p className="mt-2 text-xs tabular-nums text-slate-500 dark:text-slate-400">
        {job.pagesProcessed ?? 0}/{job.pagesDiscovered || "?"} pages &middot;{" "}
        {showTotals || job.status === "completed"
          ? `${job.productsProcessed ?? 0}/${job.productsFound ?? 0} products saved`
          : "counting products…"}
      </p>
      {(job.imagesTotal ?? 0) > 0 && (job.status === "completed" || job.phase === "downloading") && (
        <p className="mt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {job.imagesDownloaded ?? 0}/{job.imagesTotal} images downloaded
          {job.imagesFailed ? ` · ${job.imagesFailed} failed` : ""}
        </p>
      )}
      {message && job.status === "running" && (
        <p className="mt-1 text-xs font-medium text-blue-700 dark:text-blue-400">{message}</p>
      )}
      <JobActivity job={job} />
      {job.status === "completed" && (job.pagesRecovered ?? 0) > 0 && (
        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
          {job.pagesRecovered} page{job.pagesRecovered === 1 ? "" : "s"} failed at first (rate limit / crash) and were recovered by retrying.
        </p>
      )}

      {job.errors && job.errors.length > 0 && (
        job.status === "failed" ? (
          <ul className="mt-3 flex flex-col gap-1.5 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
            {job.errors.map((e, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <AlertIcon className="mt-0.5 shrink-0" />
                {e.message}
              </li>
            ))}
          </ul>
        ) : (
          <details className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <summary className="cursor-pointer font-semibold flex items-center gap-1.5 select-none">
              <AlertIcon className="shrink-0 text-amber-600 dark:text-amber-400" />
              {job.errors.length} issue{job.errors.length > 1 ? "s" : ""} remained after all retries
              {job.productsMissing ? ` · ${job.productsMissing} product${job.productsMissing > 1 ? "s" : ""} not saved` : ""}
            </summary>
            <ul className="mt-2 flex flex-col gap-1 pl-5 list-disc text-amber-700 dark:text-amber-400/90">
              {job.errors.map((e, i) => (
                <li key={i}>
                  {e.type && ERROR_TYPE_LABELS[e.type] ? <strong>{ERROR_TYPE_LABELS[e.type]}: </strong> : null}
                  {e.url ? `${e.url} — ` : ""}{e.message}
                </li>
              ))}
            </ul>
          </details>
        )
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {job.status === "completed" && (
          <div className="flex gap-2">
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
            <a
              href={`/api/jobs/${job._id}/export?format=xlsx`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <DownloadIcon />
              Export XLSX
            </a>
          </div>
        )}

        <button
          type="button"
          onClick={async () => {
            if (window.confirm(`Delete this job and its scraped products/seller from database?`)) {
              const { deleteJob } = await import("@/lib/api/jobs");
              await deleteJob(job._id);
              window.location.reload();
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          title="Delete this job and its data from MongoDB database"
        >
          <AlertIcon className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
          Delete Job Data
        </button>
      </div>
    </section>
  );
}
