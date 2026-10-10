"use client";

import { AlertIcon, CheckCircleIcon, SpinnerIcon } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import type { ScrapeJobView } from "@/types/dashboard";

type Phase = NonNullable<ScrapeJobView["phase"]>;
type StepState = "done" | "active" | "pending" | "failed";

const PHASE_ORDER: Phase[] = ["discovering", "scraping", "verifying", "downloading", "done"];

function stepDetail(job: ScrapeJobView, phase: Phase): string {
  switch (phase) {
    case "discovering":
      return `${job.pagesProcessed ?? 0} pages fetched · ${job.pagesDiscovered || "?"} found`;
    case "scraping":
      return `${job.productsProcessed ?? 0}/${job.productsFound ?? 0} products saved`;
    case "verifying":
      return job.retryRound ? `Retry round ${job.retryRound}` : "Checking for missed products";
    default:
      return `${(job.imagesDownloaded ?? 0) + (job.imagesFailed ?? 0)}/${job.imagesTotal ?? "?"} images${
        job.imagesFailed ? ` · ${job.imagesFailed} failed` : ""
      }`;
  }
}

const STEPS: { phase: Phase; label: string }[] = [
  { phase: "discovering", label: "Scan site" },
  { phase: "scraping", label: "Save products" },
  { phase: "verifying", label: "Verify" },
  { phase: "downloading", label: "Download images" },
];

function stepState(job: ScrapeJobView, phase: Phase): StepState {
  if (job.status === "completed") return "done";
  // A failed/cancelled job's phase is "done", which says nothing about how far it got: nothing found = stopped at step 1 (failed pages still count in pagesProcessed).
  if (job.status === "failed" || job.status === "cancelled") {
    return phase === "discovering" && (job.productsFound ?? 0) === 0 ? "failed" : "pending";
  }
  const current = PHASE_ORDER.indexOf(job.phase ?? "discovering");
  const index = PHASE_ORDER.indexOf(phase);
  if (index < current) return "done";
  return index === current && job.status === "running" ? "active" : "pending";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/40">
      <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  );
}

/** Side panel: overall progress, the 4 pipeline steps with their own counters, and what the worker is doing right now. */
export function LiveProgressPanel({ job }: { job: ScrapeJobView | undefined }) {
  if (!job) {
    return (
      <aside className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
        Start a scrape or pick a job — live progress shows up here.
      </aside>
    );
  }

  const running = job.status === "running" || job.status === "pending";
  const failed = job.status === "failed" || job.status === "cancelled";
  const percent = Math.round(job.status === "completed" ? 100 : failed && (job.productsFound ?? 0) === 0 ? 0 : job.progress ?? 0);

  return (
    <aside
      data-testid="live-progress-panel"
      className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Live progress</h2>
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400" title={job.sourceUrl}>
            {job.sourceUrl}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50">{percent}%</span>
          {running && job.pagesDiscovered === 0 && (
            <span className="text-xs text-slate-400">waiting for worker…</span>
          )}
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${failed ? "bg-rose-500" : "bg-blue-600 dark:bg-blue-500"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {STEPS.map(({ phase, label }, i) => {
          const state = stepState(job, phase);
          return (
            <li key={phase} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
                {state === "done" ? (
                  <CheckCircleIcon width="18" height="18" className="text-emerald-600 dark:text-emerald-400" />
                ) : state === "failed" ? (
                  <AlertIcon className="text-rose-600 dark:text-rose-400" />
                ) : state === "active" ? (
                  <SpinnerIcon className="text-blue-600 dark:text-blue-400" />
                ) : (
                  <span className="size-2.5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                )}
              </span>
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium ${
                    state === "pending" ? "text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-200"
                  }`}
                >
                  {i + 1}. {label}
                </p>
                {state === "failed" ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400">{job.errors?.[0]?.message ?? "No page could be loaded"}</p>
                ) : state !== "pending" ? (
                  <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{stepDetail(job, phase)}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {running && job.currentAction && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
          {job.currentAction}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Pages" value={`${job.pagesProcessed ?? 0}/${job.pagesDiscovered || "?"}`} />
        <Stat label="Products" value={`${job.productsProcessed ?? 0}/${job.productsFound ?? 0}`} />
        <Stat label="Images" value={`${job.imagesDownloaded ?? 0}/${job.imagesTotal ?? 0}`} />
        <Stat label="Failed" value={String((job.pagesFailed ?? 0) + (job.imagesFailed ?? 0))} />
      </div>
    </aside>
  );
}
