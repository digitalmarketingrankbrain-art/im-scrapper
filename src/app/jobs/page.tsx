"use client";

import Link from "next/link";
import { useState } from "react";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { CloseIcon, RefreshIcon, SearchIcon } from "@/components/icons";
import { useCancelJob, useRetryJob } from "@/hooks/useJobActions";
import { useJobsPage } from "@/hooks/useJobsPage";
import type { JobStatus } from "@/types/dashboard";

const STATUS_OPTIONS: { value: "all" | JobStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function JobsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"all" | JobStatus>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useJobsPage({ page, status, search });
  const retryMutation = useRetryJob();
  const cancelMutation = useCancelJob();

  const jobs = data?.data ?? [];

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Job Monitor</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {data ? `${data.meta.total.toLocaleString()} total jobs` : "Auto-refreshes every 5s"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearch} className="flex gap-1.5">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by URL…"
                className="h-8 w-52 rounded-lg border border-slate-300 bg-white pl-7 pr-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              />
            </div>
            <button
              type="submit"
              className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Search
            </button>
          </form>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "all" | JobStatus);
              setPage(1);
            }}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40">
                <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Source URL
                </th>
                <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Status
                </th>
                <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Progress
                </th>
                <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Submitted
                </th>
                <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && jobs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                    {search ? `No jobs matching "${search}"` : "No jobs found"}
                  </td>
                </tr>
              )}
              {jobs.map((job) => (
                <tr key={job._id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="max-w-xs px-4 py-3">
                    <Link href={`/jobs/${job._id}`} className="block truncate font-medium text-blue-700 hover:underline dark:text-blue-400">
                      {job.sourceUrl}
                    </Link>
                    {job.errors.length > 0 && (
                      <p className="mt-0.5 truncate text-xs text-rose-600 dark:text-rose-400">{job.errors[0].message}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {job.pagesProcessed}/{job.pagesDiscovered || "?"} pages &middot; {job.productsFound} products
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{formatTimestamp(job.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {(job.status === "failed" || job.status === "cancelled") && (
                        <button
                          type="button"
                          title="Retry"
                          disabled={retryMutation.isPending}
                          onClick={() => retryMutation.mutate(job._id)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                          <RefreshIcon width="14" height="14" />
                        </button>
                      )}
                      {job.status === "pending" && (
                        <button
                          type="button"
                          title="Cancel"
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(job._id)}
                          className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                        >
                          <CloseIcon width="14" height="14" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
            <Pagination page={data.meta.page} pages={data.meta.pages} total={data.meta.total} onPageChange={setPage} />
          </div>
        )}
      </section>
    </main>
  );
}
