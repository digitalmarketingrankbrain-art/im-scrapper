"use client";

import { catchError, type ErrorInfo } from "next/error";
import { AlertIcon } from "@/components/icons";

function ErrorFallback(props: { title: string }, { error, retry }: ErrorInfo) {
  return (
    <div
      data-testid="error-boundary-fallback"
      className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm dark:border-rose-900/50 dark:bg-rose-950/30"
    >
      <AlertIcon width="20" height="20" className="mt-0.5 shrink-0 text-rose-500 dark:text-rose-400" />
      <div>
        <p className="font-medium text-rose-700 dark:text-rose-300">{props.title}</p>
        <p className="mt-1 text-rose-600 dark:text-rose-400">
          {error instanceof Error ? error.message : "An unexpected error occurred"}
        </p>
        <button
          onClick={() => retry()}
          className="mt-3 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/40"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export default catchError(ErrorFallback);
