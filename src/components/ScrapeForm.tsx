"use client";

import { useState } from "react";
import { AlertIcon, LinkIcon, SpinnerIcon, ZapIcon } from "@/components/icons";

interface ScrapeFormProps {
  onSubmit: (sourceUrl: string, concurrency?: number) => void;
  submitting: boolean;
  error: string | null;
}

const SAMPLE_URLS = [
  {
    label: "Electric Scooter Battery (Ananda Ent.)",
    url: "https://www.indiamart.com/ananda-enterprises-gaya/?pid=2859589789733&c_id=863&mid=108093&pn=Electric%20Scooter%20Lithium%20Battery",
  },
  {
    label: "Hydraulic Machinery (Apex Machinery)",
    url: "https://www.indiamart.com/proddetail/100-ton-hydraulic-press.html",
  },
];

export function ScrapeForm({ onSubmit, submitting, error }: ScrapeFormProps) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [concurrency, setConcurrency] = useState<number>(6);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (sourceUrl.trim()) {
            onSubmit(sourceUrl.trim(), concurrency);
          }
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <LinkIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="url"
            required
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Paste IndiaMART seller or product URL..."
            className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500/10"
          />
        </div>

        {/* Speed / Concurrency Control */}
        <select
          value={concurrency}
          onChange={(e) => setConcurrency(Number(e.target.value))}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
          title="Scraping Speed / Concurrency (Parallel Workers)"
        >
          <option value={2}>Speed: Gentle (2 Workers)</option>
          <option value={6}>Speed: Standard (6 Workers)</option>
          <option value={10}>Speed: Fast (10 Workers)</option>
          <option value={16}>Speed: Ultra-Fast (16 Workers)</option>
        </select>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:from-blue-500 hover:to-indigo-500 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <SpinnerIcon className="text-white" />
              Scraping...
            </>
          ) : (
            <>
              <ZapIcon width="16" height="16" />
              Start Scrape
            </>
          )}
        </button>
      </form>

      {/* Quick Samples */}
      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium text-slate-400 dark:text-slate-500">Quick Test URLs:</span>
        {SAMPLE_URLS.map((sample) => (
          <button
            key={sample.url}
            type="button"
            onClick={() => setSourceUrl(sample.url)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-400"
          >
            + {sample.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
          <AlertIcon className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
