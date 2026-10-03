"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertIcon, ChevronLeftIcon, CloseIcon, DownloadIcon, RefreshIcon } from "@/components/icons";
import { JobActivity } from "@/components/JobActivity";
import { StatusBadge } from "@/components/StatusBadge";
import { useCancelJob, useRetryJob } from "@/hooks/useJobActions";
import { useJob } from "@/hooks/useJob";
import { useJobResults } from "@/hooks/useJobResults";
import { ACTIVE_JOB_STATUSES } from "@/types/dashboard";

const ResultsTabs = dynamic(() => import("@/components/ResultsTabs"));

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
    </div>
  );
}

function TimelineRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800/60">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-900 dark:text-slate-50">
        {value ? new Date(value).toLocaleString() : <span className="text-slate-400 dark:text-slate-500">—</span>}
      </span>
    </div>
  );
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: job, isLoading } = useJob(id ?? null);
  const { data: results } = useJobResults(id ?? null, job?.status);
  const retryMutation = useRetryJob();
  const cancelMutation = useCancelJob();

  if (isLoading) {
    return <div className="p-8 text-sm text-slate-500 dark:text-slate-400">Loading job…</div>;
  }
  if (!job) {
    return (
      <div className="flex flex-col items-center gap-3 p-16 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">Job not found</p>
        <button onClick={() => router.push("/jobs")} className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-400">
          Back to Jobs
        </button>
      </div>
    );
  }

  const isActive = ACTIVE_JOB_STATUSES.has(job.status);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-start gap-3">
        <Link
          href="/jobs"
          className="mt-0.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ChevronLeftIcon width="18" height="18" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Job Detail</h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="mt-1 truncate font-mono text-xs text-slate-400 dark:text-slate-500">{job._id}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {(job.status === "failed" || job.status === "cancelled") && (
            <button
              type="button"
              disabled={retryMutation.isPending}
              onClick={() => retryMutation.mutate(job._id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshIcon width="14" height="14" /> Retry
            </button>
          )}
          {job.status === "pending" && (
            <button
              type="button"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate(job._id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              <CloseIcon width="14" height="14" /> Cancel
            </button>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Source</h2>
        <a
          href={job.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block truncate text-sm text-blue-700 hover:underline dark:text-blue-400"
        >
          {job.sourceUrl}
        </a>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Progress</h2>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-500 ease-out dark:bg-blue-500"
            style={{ width: `${job.progress}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox label="Pages discovered" value={job.pagesDiscovered} />
          <StatBox label="Pages processed" value={job.pagesProcessed} />
          <StatBox label="Products found" value={job.productsFound} />
          <StatBox label="Products processed" value={job.productsProcessed} />
        </div>
        {(job.imagesTotal ?? 0) > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatBox label="Images found" value={job.imagesTotal ?? 0} />
            <StatBox label="Images downloaded" value={job.imagesDownloaded ?? 0} />
            <StatBox label="Images failed" value={job.imagesFailed ?? 0} />
          </div>
        )}
        {(job.status === "completed" || job.phase === "verifying") && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatBox label="Pages recovered by retry" value={job.pagesRecovered ?? 0} />
            <StatBox label="Pages still failed" value={job.pagesFailed ?? 0} />
            <StatBox label="Products not saved" value={job.productsMissing ?? 0} />
          </div>
        )}
        <JobActivity job={job} />
        {isActive && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
            </span>
            Auto-refreshing every 2s
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Timeline</h2>
        <div className="mt-2">
          <TimelineRow label="Submitted" value={job.createdAt} />
          <TimelineRow label="Started" value={job.startedAt} />
          <TimelineRow label="Completed" value={job.completedAt} />
        </div>
      </section>

      {job.errors.length > 0 && (
        <section className="rounded-xl border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-500/30 dark:bg-slate-900">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
            <AlertIcon width="14" height="14" /> Errors
          </h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {job.errors.map((e, i) => (
              <li key={i} className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
                {e.url ? `${e.url} — ` : ""}{e.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {job.status === "completed" && (
        <div className="flex gap-2">
          <a
            href={`/api/jobs/${job._id}/export?format=json`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <DownloadIcon width="14" height="14" /> Export JSON
          </a>
          <a
            href={`/api/jobs/${job._id}/export?format=csv`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <DownloadIcon width="14" height="14" /> Export CSV
          </a>
        </div>
      )}

      {results && (results.seller || results.products.length > 0) && (
        <ResultsTabs seller={results.seller} products={results.products} />
      )}
    </main>
  );
}
