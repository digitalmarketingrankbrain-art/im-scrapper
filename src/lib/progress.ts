import type { ScrapeJobView } from "@/types/dashboard";

/** Products the scraper is finished with, whatever the outcome — saved, skipped (too few specs) or failed. Equals `productsFound` once step 2 is over, so "x/y" actually reaches y. */
export function productsHandled(job: Pick<ScrapeJobView, "productsProcessed" | "productsSkipped" | "productsFailed">): number {
  return (job.productsProcessed ?? 0) + (job.productsSkipped ?? 0) + (job.productsFailed ?? 0);
}

/** Images finished either way (stored or failed). */
export function imagesHandled(job: Pick<ScrapeJobView, "imagesDownloaded" | "imagesFailed">): number {
  return (job.imagesDownloaded ?? 0) + (job.imagesFailed ?? 0);
}

/** "12 saved · 3 skipped · 1 failed", leaving out the zero parts. */
export function productBreakdown(job: Pick<ScrapeJobView, "productsProcessed" | "productsSkipped" | "productsFailed">): string {
  return [
    `${job.productsProcessed ?? 0} saved`,
    job.productsSkipped ? `${job.productsSkipped} skipped` : "",
    job.productsFailed ? `${job.productsFailed} failed` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
