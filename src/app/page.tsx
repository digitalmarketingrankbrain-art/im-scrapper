"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import { JobProgressCard } from "@/components/JobProgressCard";
import { RecentJobsList } from "@/components/RecentJobsList";
import { ScrapeForm } from "@/components/ScrapeForm";
import { TrashIcon, CheckCircleIcon, SpinnerIcon } from "@/components/icons";
import { useCreateJob } from "@/hooks/useCreateJob";
import { useJob } from "@/hooks/useJob";
import { useJobResults } from "@/hooks/useJobResults";
import { useRecentJobs } from "@/hooks/useRecentJobs";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectJob } from "@/store/uiSlice";
import type { ScrapeJobView } from "@/types/dashboard";

const DashboardErrorBoundary = dynamic(() => import("@/components/DashboardErrorBoundary"));

const ResultsTabs = dynamic(() => import("@/components/ResultsTabs"), {
  loading: () => (
    <div
      data-testid="results-loading"
      className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex gap-4 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
        <div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="flex flex-col gap-3 p-5">
        <div className="h-3 w-full max-w-sm rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-3 w-full max-w-xs rounded bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  ),
});

export default function Home() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const selectedJobId = useAppSelector((state) => state.ui.selectedJobId);

  const [clearingDb, setClearingDb] = useState(false);
  const [clearNotice, setClearNotice] = useState<string | null>(null);

  const { data: recentJobs = [] } = useRecentJobs();
  const { data: job } = useJob(selectedJobId);
  const { data: results } = useJobResults(selectedJobId, job?.status);
  const createJobMutation = useCreateJob();

  function handleSubmit(sourceUrl: string) {
    setClearNotice(null);
    createJobMutation.mutate(sourceUrl, {
      onSuccess: (data) => {
        dispatch(selectJob(data.jobId));
      },
    });
  }

  function handleSelectRecentJob(recentJob: ScrapeJobView) {
    dispatch(selectJob(recentJob._id));
  }

  async function handleClearDatabase() {
    if (!window.confirm("Are you sure you want to delete all scraped sellers, products, and jobs from MongoDB?")) {
      return;
    }
    setClearingDb(true);
    try {
      const res = await fetch("/api/db/clear", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        dispatch(selectJob(""));
        queryClient.invalidateQueries();
        setClearNotice(data.message || "Database cleared successfully!");
      } else {
        alert(`Error clearing database: ${data.message}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setClearingDb(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              IndiaMART Data Scraper & Engine
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Extract detailed seller contact info, products, prices, MOQ, specifications, and images.
            </p>
          </div>

          {/* Clear DB Button */}
          <button
            onClick={handleClearDatabase}
            disabled={clearingDb}
            className="inline-flex items-center gap-2 shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shadow-xs disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60"
          >
            {clearingDb ? (
              <SpinnerIcon className="text-rose-600 dark:text-rose-300" />
            ) : (
              <TrashIcon width="16" height="16" />
            )}
            Clear Database
          </button>
        </header>

        {/* Clear Banner */}
        {clearNotice && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircleIcon width="16" height="16" />
            {clearNotice}
          </div>
        )}

        {/* Input Form */}
        <ScrapeForm
          onSubmit={handleSubmit}
          submitting={createJobMutation.isPending}
          error={createJobMutation.error?.message ?? null}
        />

        {/* Progress Monitor */}
        {job && <JobProgressCard job={job} />}

        {/* Results Container */}
        {results && (results.seller || results.products.length > 0) && (
          <DashboardErrorBoundary title="Couldn't display results">
            <ResultsTabs seller={results.seller} products={results.products} />
          </DashboardErrorBoundary>
        )}

        {/* Recent Jobs Drawer */}
        <RecentJobsList jobs={recentJobs} onSelect={handleSelectRecentJob} />
      </main>
    </div>
  );
}
