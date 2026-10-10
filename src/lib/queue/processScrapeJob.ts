import { env } from "@/lib/config/env";
import { dbConnect } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";
import { ScrapeJobModel } from "@/lib/db/models/ScrapeJob";
import { downloadProductImages } from "@/lib/images/download";
import { SellerModel } from "@/lib/db/models/Seller";
import { upsertProduct, upsertSeller } from "@/lib/db/repositories";
import { logEvent } from "@/lib/logger";
import { CrawlSession, type CrawlActivity, type CrawlResultPage } from "@/scraper/crawler";
import { extractProducts } from "@/scraper/extract/product";
import { extractSeller } from "@/scraper/extract/seller";
import type { Product, ScrapePhase, ScrapeSource } from "@/types";

function sourceFromUrl(url: string): ScrapeSource {
  return new URL(url).hostname.includes("indiamart.com") ? "indiamart" : "seller_website";
}

/** Runs async callbacks one at a time in call order, so concurrent crawl workers never `job.save()` at the same moment (Mongoose's optimistic-concurrency `__v` check throws VersionError on overlapping saves of the same document). */
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

/** How many times a product that failed to reach the database is re-attempted at the end. */
const SAVE_RETRY_ATTEMPTS = 3;

/**
 * Bar layout across the workflow, so the percentage only ever moves forward:
 * discovering 0-35, scraping 35-65, verifying 65-80, downloading images 80-99, done 100.
 */
const PROGRESS_BANDS: Record<Exclude<ScrapePhase, "done">, [number, number]> = {
  discovering: [0, 35],
  scraping: [35, 65],
  verifying: [65, 80],
  downloading: [80, 99],
};

function bandProgress(phase: Exclude<ScrapePhase, "done">, fraction: number): number {
  const [from, to] = PROGRESS_BANDS[phase];
  return Math.round(from + (to - from) * Math.min(Math.max(fraction, 0), 1));
}

/**
 * Four-step workflow, so the totals the user sees stop moving before any data is saved:
 *
 *  1. discovering — crawl the site and fetch every reachable page. Pages come back with their
 *     parsed HTML, so the number of pages AND distinct products is known once this ends.
 *  2. scraping    — save every product found to the database against the now-fixed totals.
 *     (The pages are not fetched a second time: re-requesting them would double the load on
 *     the site and invite more 429s.)
 *  3. verifying   — pages that failed for transient reasons (rate limit, browser crash, timeout)
 *     are re-fetched in rounds with growing cooldowns and rotated IPs, their products saved, and
 *     finally every product found is checked against the database; anything missing is re-saved.
 *  4. downloading — every image of every saved product is downloaded to disk
 *     (downloads/images/<seller>/<product>/) and its file path recorded on the product.
 */
export async function processScrapeJob(jobId: string, sourceUrl: string, concurrency?: number): Promise<void> {
  await dbConnect();

  // POST /api/jobs hands the job to both the BullMQ worker and an in-process fallback; claiming it
  // atomically means only the first runner crawls. Without this the site gets crawled twice in parallel.
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

  const source = sourceFromUrl(sourceUrl);
  const serialize = createSerializer();
  let sellerId: string | undefined;

  /** Every distinct product found so far, keyed by the same trimmed name the database upserts on. */
  const found = new Map<string, Partial<Product>>();
  const saved = new Set<string>();

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
    // ---- 1. discovering -------------------------------------------------
    void note({ message: `Step 1/4 · Scanning ${sourceUrl}`, level: "info" });
    const session = new CrawlSession(sourceUrl, {
      concurrency,
      onActivity: (activity) => void note(activity),
      onPage: (_page, discovered) =>
        serialize(async () => {
          job.pagesDiscovered = discovered;
          job.pagesProcessed = session.pages.size;
          job.progress = bandProgress("discovering", job.pagesDiscovered > 0 ? job.pagesProcessed / job.pagesDiscovered : 0);
          await job.save();
        }),
    });

    await session.discover();

    /** Pulls products from every fetched page that has not been collected yet. */
    const collectProducts = (pages: CrawlResultPage[]) => {
      for (const page of pages) {
        const parsed = page.scrapeResult?.data;
        if (!parsed) continue;
        for (const prod of extractProducts(parsed, page.url, source)) {
          const name = prod.name?.trim();
          if (!name || name === "Unknown product" || found.has(name)) continue;
          found.set(name, { ...prod, name, sourceUrl: prod.sourceUrl || page.url });
        }
      }
    };

    /** The seller comes from the first page that loaded — normally the start URL, but that page itself can be the one that got rate-limited. */
    const ensureSeller = async () => {
      if (sellerId) return;
      const firstOk = session.pages.get(session.startUrl) ?? session.successfulPages()[0];
      const candidate = firstOk?.status === "success" ? firstOk : session.successfulPages()[0];
      if (!candidate?.scrapeResult?.data) return;
      const sellerData = extractSeller(candidate.scrapeResult.data, candidate.url, source);
      const seller = await upsertSeller({ ...sellerData, sourceUrl });
      sellerId = String(seller._id);
      job.sellerId = seller._id;
    };

    /** Saves every collected product not yet saved. Returns how many were saved this call. */
    const persistPending = async (phase: Exclude<ScrapePhase, "done">): Promise<number> => {
      await ensureSeller();
      if (!sellerId) return 0;
      let count = 0;
      for (const [name, prod] of found) {
        if (saved.has(name)) continue;
        try {
          await upsertProduct(sellerId, prod);
          saved.add(name);
          count++;
        } catch (error) {
          // Left out of `saved` on purpose — the reconcile step at the end retries it.
          logEvent({ event: "PRODUCT_SAVE_FAILED", jobId, url: String(prod.sourceUrl), error: String(error) });
        }
        await serialize(async () => {
          job.productsProcessed = saved.size;
          job.progress = bandProgress(phase, found.size > 0 ? saved.size / found.size : 1);
          await job.save();
        });
      }
      return count;
    };

    collectProducts(session.successfulPages());
    await serialize(async () => {
      // Totals are settled here: this is the number the UI shows while scraping.
      job.phase = "scraping";
      job.pagesDiscovered = Math.max(session.totalPages, session.pages.size);
      job.pagesProcessed = session.pages.size;
      job.productsFound = found.size;
      job.progress = bandProgress("scraping", 0);
      if (session.totalPages > session.pages.size) {
        job.errors.push({
          type: "validation_error",
          message: `Page limit (${env.MAX_PAGES}) reached — ${session.totalPages - session.pages.size} discovered pages were not fetched. Raise MAX_PAGES to cover them.`,
          occurredAt: new Date(),
        });
      }
      await job.save();
    });
    await note({
      message: `Step 1/4 done · ${job.pagesDiscovered} pages, ${found.size} products found (${session.failedPages().length} pages failed so far)`,
      level: "success",
    });
    logEvent({
      event: "JOB_DISCOVERY_DONE",
      jobId,
      url: sourceUrl,
      status: "discovered",
      pages: job.pagesDiscovered,
      products: found.size,
      failedPages: session.failedPages().length,
    });

    // ---- 2. scraping ----------------------------------------------------
    await note({ message: `Step 2/4 · Saving ${found.size} products to the database`, level: "info" });
    await persistPending("scraping");
    await note({ message: `Step 2/4 done · ${saved.size}/${found.size} products saved`, level: "success" });

    // ---- 3. verifying ---------------------------------------------------
    for (let round = 1; round <= env.MAX_VERIFY_ROUNDS; round++) {
      if (session.retryableFailedPages().length === 0) break;

      await serialize(async () => {
        job.phase = "verifying";
        job.retryRound = round;
        await job.save();
      });

      const recoveredThisRound = await session.retryFailed(round);

      collectProducts(session.successfulPages());
      await serialize(async () => {
        job.pagesDiscovered = Math.max(job.pagesDiscovered, session.totalPages, session.pages.size);
        job.pagesProcessed = session.pages.size;
        job.pagesRecovered = session.pagesRecovered;
        job.productsFound = found.size;
        await job.save();
      });
      await persistPending("verifying");

      // Another round against an IP that is still blocked only burns a minute per page.
      if (recoveredThisRound === 0 && session.lastRoundBlocked) {
        await note({ message: "Still rate limited after retrying — stopping retries; remaining pages stay unfetched", level: "warn" });
        break;
      }
    }

    await note({ message: "Step 3/4 · Cross-checking found products against the database", level: "info" });
    // Reconcile: trust the database, not our own bookkeeping, for what actually got saved.
    await setPhase("verifying");
    for (let attempt = 0; attempt < SAVE_RETRY_ATTEMPTS; attempt++) {
      if (sellerId) {
        const inDb = new Set<string>(
          (await ProductModel.find({ sellerId, name: { $in: [...found.keys()] } }).select("name").lean()).map((p) =>
            String((p as { name: string }).name),
          ),
        );
        saved.clear();
        for (const name of inDb) saved.add(name);
      }
      if (saved.size >= found.size) break;
      await persistPending("verifying");
    }

    // ---- 4. downloading images ------------------------------------------
    let imageFailures: { url: string; product: string; error: string }[] = [];
    if (sellerId) {
      await setPhase("downloading");
      try {
        const seller = await SellerModel.findById(sellerId).select("name").lean();
        await note({ message: "Step 4/4 · Downloading product images", level: "info" });
        const images = await downloadProductImages({
          sellerId,
          sellerName: (seller as { name?: string } | null)?.name ?? "seller",
          onProgress: (p, message) =>
            serialize(async () => {
              job.imagesTotal = p.total;
              job.imagesDownloaded = p.downloaded;
              job.imagesFailed = p.failed;
              job.progress = bandProgress("downloading", p.total > 0 ? (p.downloaded + p.failed) / p.total : 1);
              job.currentAction = message ?? `Downloading images — ${p.downloaded + p.failed}/${p.total}`;
              job.lastActivityAt = new Date();
              await job.save();
            }),
        });
        imageFailures = images.failures;
        await note({
          message: `Step 4/4 done · ${images.downloaded}/${images.total} images saved to ${images.directory}`,
          level: images.failed > 0 ? "warn" : "success",
        });
      } catch (error) {
        // Images are a bonus on top of the scraped data — never fail the whole job over them.
        const message = error instanceof Error ? error.message : String(error);
        logEvent({ event: "IMAGES_FAILED", jobId, status: "failed", error: message });
        await note({ message: `Image download stopped: ${message}`, level: "error" });
      }
    }

    const stillFailed = session.failedPages();
    const noPagesLoaded = session.successfulPages().length === 0;

    await serialize(async () => {
      job.pagesProcessed = session.pages.size;
      job.pagesRecovered = session.pagesRecovered;
      job.pagesFailed = stillFailed.length;
      job.productsFound = found.size;
      job.productsProcessed = saved.size;
      job.productsMissing = Math.max(found.size - saved.size, 0);

      // Only pages that never recovered stay in the error list — transient failures that a retry fixed are not errors.
      for (const page of stillFailed) {
        job.errors.push({
          url: page.url,
          type: page.scrapeResult?.error?.type ?? "unknown_error",
          message: page.scrapeResult?.error?.message ?? "Page scrape failed",
          occurredAt: new Date(),
        });
      }
      for (const failure of imageFailures.slice(0, 10)) {
        job.errors.push({
          url: failure.url,
          type: "network_error",
          message: `Image for "${failure.product}" not downloaded — ${failure.error}`,
          occurredAt: new Date(),
        });
      }
      if (imageFailures.length > 10) {
        job.errors.push({
          type: "network_error",
          message: `…and ${imageFailures.length - 10} more images could not be downloaded.`,
          occurredAt: new Date(),
        });
      }
      if (job.productsMissing > 0) {
        job.errors.push({
          type: "unknown_error",
          message: `${job.productsMissing} product(s) were found but could not be saved to the database.`,
          occurredAt: new Date(),
        });
      }

      job.phase = "done";
      job.currentAction = undefined;
      job.waitingUntil = undefined;
      // A job that never loaded a single page did not get 100% of anything.
      if (!noPagesLoaded) job.progress = 100;
      job.status = noPagesLoaded ? "failed" : "completed";
      job.completedAt = new Date();
      await job.save();
    });

    logEvent({
      event: noPagesLoaded ? "JOB_FAILED" : "JOB_COMPLETED",
      jobId,
      url: sourceUrl,
      status: job.status,
      pages: job.pagesDiscovered,
      recovered: job.pagesRecovered,
      failedPages: stillFailed.length,
      products: found.size,
      saved: saved.size,
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
