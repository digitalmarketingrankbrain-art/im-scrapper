"use client";

import { useEffect, useState } from "react";
import type { ScrapeJobView } from "@/types/dashboard";

/** No worker write for this long while "running" means the worker is gone or wedged, not just busy. */
const STALE_AFTER_MS = 90_000;

const LEVEL_STYLES: Record<string, string> = {
  info: "text-slate-600 dark:text-slate-400",
  success: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  error: "text-rose-700 dark:text-rose-400",
};

function formatAgo(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ${s % 60}s ago`;
}

/** Live view of what a running job is doing: current step, rate-limit countdown, heartbeat and recent history. */
export function JobActivity({ job }: { job: ScrapeJobView }) {
  const [now, setNow] = useState(() => Date.now());
  const running = job.status === "running";

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const history = job.activity ?? [];
  if (!running && history.length === 0) return null;

  const lastAt = job.lastActivityAt ? new Date(job.lastActivityAt).getTime() : null;
  const sinceLast = lastAt ? now - lastAt : null;
  const waitLeft = job.waitingUntil ? new Date(job.waitingUntil).getTime() - now : 0;
  const waiting = running && waitLeft > 0;
  // A deliberate cooldown is not a hang, so only flag silence when we're not in one.
  const stale = running && !waiting && sinceLast !== null && sinceLast > STALE_AFTER_MS;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/40">
      {running && (
        <div className="flex items-start gap-2">
          <span className="relative mt-1 flex size-2 shrink-0">
            {!stale && (
              <span
                className={`absolute inline-flex size-full animate-ping rounded-full opacity-75 ${waiting ? "bg-amber-400" : "bg-blue-400"}`}
              />
            )}
            <span
              className={`relative inline-flex size-2 rounded-full ${stale ? "bg-rose-500" : waiting ? "bg-amber-500" : "bg-blue-500"}`}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="break-words font-medium text-slate-800 dark:text-slate-200">
              {job.currentAction ?? "Starting…"}
            </p>
            <p className="mt-0.5 tabular-nums text-slate-500 dark:text-slate-400">
              {waiting && <span className="font-semibold text-amber-700 dark:text-amber-400">Resumes in {Math.ceil(waitLeft / 1000)}s · </span>}
              {sinceLast !== null ? `last update ${formatAgo(sinceLast)}` : "waiting for the worker to pick this up"}
            </p>
            {stale && (
              <p className="mt-1 font-semibold text-rose-700 dark:text-rose-400">
                No update for over {Math.round(STALE_AFTER_MS / 1000)}s — the worker may be stopped. Check that `npm run worker` is running.
              </p>
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <details className={running ? "mt-2" : ""} open={running}>
          <summary className="cursor-pointer select-none font-semibold text-slate-600 dark:text-slate-400">
            Activity log ({history.length})
          </summary>
          <ul className="mt-1.5 flex max-h-48 flex-col gap-0.5 overflow-y-auto font-mono">
            {[...history].reverse().map((entry, i) => (
              <li key={`${entry.at}-${i}`} className={`break-words ${LEVEL_STYLES[entry.level] ?? LEVEL_STYLES.info}`}>
                <span className="text-slate-400 dark:text-slate-500">{new Date(entry.at).toLocaleTimeString()} </span>
                {entry.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
