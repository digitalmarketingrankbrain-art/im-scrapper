"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-zinc-50 p-8 text-center dark:bg-black">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Something went wrong!</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{error.message}</p>
      <button
        onClick={() => retry()}
        className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Try again
      </button>
    </div>
  );
}
