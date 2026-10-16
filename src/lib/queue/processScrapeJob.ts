import { dbConnect } from "@/lib/db/connect";
import { ScrapeJobModel } from "@/lib/db/models/ScrapeJob";
import { downloadProductImages } from "@/lib/images/download";
import { upsertProduct, upsertSeller } from "@/lib/db/repositories";
import { logEvent } from "@/lib/logger";
import type { CrawlActivity } from "@/scraper/crawler";
import { detectScrapeMode, discoverProductUrls } from "@/scraper/discover";
import { scrapeSingleProduct, type SellerPageCache } from "@/scraper/product/scrapeSingleProduct";
import type { ScrapeJobMode, ScrapePhase } from "@/types";
import { runProductBatch } from "./productBatch";

/** Runs async callbacks one at a time in call order, so concurrent callbacks never `job.save()` at the same moment (Mongoose's optimistic-concurrency `__v` check throws VersionError on overlapping saves of the same document). */
function createSerializer() {
  let tail: Promise<unknown> = Promise.resolve();
  return function serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = tail.then(fn, fn);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

/**
 * Bar layout across the workflow, so the percentage only ever moves forward:
 * discovering 0-20, scraping 20-80, downloading images 80-99, done 100.
 */
const PROGRESS_BANDS: Record<Exclude<ScrapePhase, "done" | "verifying">, [number, number]> = {
  discovering: [0, 20],
  scraping: [20, 80],
  downloading: [80, 99],
};

function bandProgress(phase: keyof typeof PROGRESS_BANDS, fraction: number): number {
  const [from, to] = PROGRESS_BANDS[phase];
  return Math.round(from + (to - from) * Math.min(Math.max(fraction, 0), 1));
}

const MAX_ERRORS_LISTED = 25;

/**
 * Three input types, one pipeline:
 *
 *   product URL ─────────────┐
 *   seller catalog URL ──────┼─▶ discover product URLs ─▶ scrapeSingleProduct (per URL)
 *   category / listing URL ──┘            │                       │
 *                                          │            specs >= 3 ? images <= 5, seller, breadcrumb
 *                                          ▼                       ▼
 *                                   (URL discovery only)     dedupe + save ─▶ download images
 *
 * A product that fails is logged and the batch continues; a product with fewer than 3 specs is skipped.
 */
export async function processScrapeJob(jobId: string, sourceUrl: string, concurrency?: number): Promise<void> {
  await dbConnect();

  // POST /api/jobs hands the job to both the BullMQ worker and an in-process fallback; claiming it
  // atomically means only the first runner works on it. Without this the site gets scraped twice in parallel.
  const job = await ScrapeJobModel.findOneAndUpdate(
    { _id: jobId, status: "pending" },
    { $set: { status: "running", phase: "discovering", startedAt: new Date(), errors: [] } },
    { new: true },
  );
  if (!job) {
    const exists = await ScrapeJobModel.exists({ _id: jobId });
    if (!exists) throw new Error(`ScrapeJob ${jobId} not found`);
    logEvent({ event: "JOB_ALREADY_CLAIMED", jobId, url: sourceUrl, status: "skipped" });
    return;
  }

  const serialize = createSerializer();
  const mode: ScrapeJobMode = job.mode ?? detectScrapeMode(sourceUrl);

  const MAX_ACTIVITY_ENTRIES = 40;
  /** Records what the worker is doing. Transient notes only replace the "now" line; others also join the history. */
  const note = (activity: CrawlActivity) =>
    serialize(async () => {
      job.currentAction = activity.message;
      job.waitingUntil = activity.waitUntil ? new Date(activity.waitUntil) : undefined;
      job.lastActivityAt = new Date();
      if (!activity.transient) {
        job.activity.push({ at: new Date(), message: activity.message, level: activity.level });
        if (job.activity.length > MAX_ACTIVITY_ENTRIES) job.activity.splice(0, job.activity.length - MAX_ACTIVITY_ENTRIES);
      }
      await job.save();
    }).catch(() => undefined);

  const setPhase = (phase: ScrapePhase) =>
    serialize(async () => {
      job.phase = phase;
      await job.save();
    });

  try {
    await serialize(async () => {
      job.mode = mode;
      await job.save();
    });

    // ---- 1. discovering: URLs only -----------------------------------------
    void note({ message: `Step 1/3 · Finding products (${mode}) from ${sourceUrl}`, level: "info" });
    // A retry round reports the same page again; count each URL once so "pages" never exceeds the total.
    const seenPages = new Set<string>();
    const discovery = await discoverProductUrls(mode, sourceUrl, {
      concurrency,
      onActivity: (activity) => void note(activity),
      onPage: (page, discovered) =>
        serialize(async () => {
          seenPages.add(page.url);
          job.pagesDiscovered = Math.max(discovered, seenPages.size);
          job.pagesProcessed = seenPages.size;
          job.progress = bandProgress("discovering", job.pagesDiscovered > 0 ? job.pagesProcessed / job.pagesDiscovered : 0);
          await job.save();
        }),
    });

    await serialize(async () => {
      job.phase = "scraping";
      job.pagesDiscovered = discovery.pagesDiscovered;
      job.pagesProcessed = discovery.pagesProcessed;
      job.pagesFailed = discovery.failedPages.length;
      job.productsFound = discovery.urls.length;
      job.progress = bandProgress("scraping", 0);
      for (const page of discovery.failedPages.slice(0, MAX_ERRORS_LISTED)) {
        job.errors.push({ url: page.url, type: page.type, message: page.message, occurredAt: new Date() });
      }
      await job.save();
    });
    await note({ message: `Step 1/3 done · ${discovery.urls.length} product${discovery.urls.length === 1 ? "" : "s"} found`, level: "success" });
    logEvent({ event: "JOB_DISCOVERY_DONE", jobId, url: sourceUrl, status: "discovered", mode, products: discovery.urls.length, failedPages: discovery.failedPages.length });

    // ---- 2. scraping: every URL through the one common scraper ----------------
    await note({ message: `Step 2/3 · Scraping ${discovery.urls.length} product page${discovery.urls.length === 1 ? "" : "s"}`, level: "info" });
    const sellerPages: SellerPageCache = new Map();
    /** Sellers touched by this job, so images can be downloaded per seller afterwards. */
    const sellers = new Map<string, string>();

    const summary = await runProductBatch(
      discovery.urls,
      {
        scrape: (url) => scrapeSingleProduct(url, { sellerPages }),
        save: async (result) => {
          const seller = await upsertSeller(result.seller);
          const sellerId = String(seller._id);
          sellers.set(sellerId, String(seller.name ?? "seller"));
          await upsertProduct(sellerId, { ...result.product, jobId });
          if (!job.sellerId) job.sellerId = seller._id;
        },
      },
      {
        onNote: (message, level) => void note({ message, level }),
        onProgress: (batch, done) =>
          serialize(async () => {
            job.productsProcessed = batch.saved;
            job.productsSkipped = batch.skipped.length;
            job.productsFailed = batch.failed.length;
            job.progress = bandProgress("scraping", batch.total > 0 ? done / batch.total : 1);
            await job.save();
          }),
      },
    );
    await note({
      message: `Step 2/3 done · ${summary.saved} saved, ${summary.skipped.length} skipped (fewer than 3 specs), ${summary.failed.length} failed`,
      level: summary.failed.length > 0 ? "warn" : "success",
    });

    // ---- 3. downloading images (max 5 per product were already chosen) ---------
    let imageFailures: { url: string; product: string; error: string }[] = [];
    if (sellers.size > 0) {
      await setPhase("downloading");
      await note({ message: "Step 3/3 · Downloading product images", level: "info" });
      const totals = { total: 0, downloaded: 0, failed: 0 };
      for (const [sellerId, sellerName] of sellers) {
        try {
          const base = { ...totals };
          const images = await downloadProductImages({
            sellerId,
            sellerName,
            onProgress: (p, message) =>
              serialize(async () => {
                job.imagesTotal = base.total + p.total;
                job.imagesDownloaded = base.downloaded + p.downloaded;
                job.imagesFailed = base.failed + p.failed;
                // max(): the retry pass briefly lowers the failed count, which must not move the bar backwards.
                job.progress = Math.max(job.progress ?? 0, bandProgress("downloading", job.imagesTotal > 0 ? (job.imagesDownloaded + job.imagesFailed) / job.imagesTotal : 1));
                job.currentAction = message ?? `Downloading images — ${job.imagesDownloaded + job.imagesFailed}/${job.imagesTotal}`;
                job.lastActivityAt = new Date();
                await job.save();
              }),
          });
          totals.total += images.total;
          totals.downloaded += images.downloaded;
          totals.failed += images.failed;
          imageFailures = imageFailures.concat(images.failures);
        } catch (error) {
          // Images are a bonus on top of the scraped data — never fail the whole job over them.
          const message = error instanceof Error ? error.message : String(error);
          logEvent({ event: "IMAGES_FAILED", jobId, status: "failed", error: message });
          await note({ message: `Image download stopped for ${sellerName}: ${message}`, level: "error" });
        }
      }
      await note({
        message: `Step 3/3 done · ${totals.downloaded}/${totals.total} images saved`,
        level: totals.failed > 0 ? "warn" : "success",
      });
    }

    // A job that found nothing to work on, or whose every product failed, did not do its job.
    const nothingWorked = discovery.urls.length === 0 || (summary.saved === 0 && summary.skipped.length === 0 && summary.failed.length > 0);

    await serialize(async () => {
      job.productsProcessed = summary.saved;
      job.productsSkipped = summary.skipped.length;
      job.productsFailed = summary.failed.length;
      job.productsMissing = summary.failed.length;

      for (const failure of summary.failed.slice(0, MAX_ERRORS_LISTED)) {
        job.errors.push({ url: failure.url, type: failure.type, message: failure.message, occurredAt: new Date() });
      }
      if (summary.failed.length > MAX_ERRORS_LISTED) {
        job.errors.push({ type: "unknown_error", message: `…and ${summary.failed.length - MAX_ERRORS_LISTED} more products failed.`, occurredAt: new Date() });
      }
      if (discovery.urls.length === 0 && discovery.failedPages.length === 0) {
        job.errors.push({ type: "validation_error", message: `No product pages were found at this ${mode === "product" ? "URL" : mode} URL.`, occurredAt: new Date() });
      }
      for (const failure of imageFailures.slice(0, 10)) {
        job.errors.push({ url: failure.url, type: "network_error", message: `Image for "${failure.product}" not downloaded — ${failure.error}`, occurredAt: new Date() });
      }

      job.phase = "done";
      job.currentAction = undefined;
      job.waitingUntil = undefined;
      if (!nothingWorked) job.progress = 100;
      job.status = nothingWorked ? "failed" : "completed";
      job.completedAt = new Date();
      await job.save();
    });

    logEvent({
      event: nothingWorked ? "JOB_FAILED" : "JOB_COMPLETED",
      jobId,
      url: sourceUrl,
      status: job.status,
      mode,
      products: discovery.urls.length,
      saved: summary.saved,
      skipped: summary.skipped.length,
      failed: summary.failed.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    job.status = "failed";
    job.phase = "done";
    job.errors.push({ type: "unknown_error", message, occurredAt: new Date() });
    job.completedAt = new Date();
    await job.save();
    logEvent({ event: "JOB_FAILED", jobId, url: sourceUrl, status: "failed", error: message });
    throw error;
  }
}
