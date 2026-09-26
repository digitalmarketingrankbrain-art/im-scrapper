import { dbConnect } from "@/lib/db/connect";
import { ScrapeJobModel } from "@/lib/db/models/ScrapeJob";
import { upsertProduct, upsertSeller } from "@/lib/db/repositories";
import { logEvent } from "@/lib/logger";
import { crawl } from "@/scraper/crawler";
import { extractProducts } from "@/scraper/extract/product";
import { extractSeller } from "@/scraper/extract/seller";
import type { ScrapeSource } from "@/types";

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

/**
 * Crawls sourceUrl, extracting + persisting seller/product data and updating the ScrapeJob's
 * progress as each page completes — the crawler itself fetches pages concurrently, but bookkeeping
 * here runs serialized so progress updates land in page-completion order.
 */
export async function processScrapeJob(jobId: string, sourceUrl: string): Promise<void> {
  await dbConnect();

  const job = await ScrapeJobModel.findById(jobId);
  if (!job) throw new Error(`ScrapeJob ${jobId} not found`);

  job.status = "running";
  job.startedAt = new Date();
  await job.save();

  const source = sourceFromUrl(sourceUrl);
  const serialize = createSerializer();
  let sellerId: string | undefined;
  let productsFound = 0;
  let productsProcessed = 0;

  try {
    const summary = await crawl(sourceUrl, {
      onPage: (page, discovered) =>
        serialize(async () => {
          job.pagesDiscovered = discovered;
          job.pagesProcessed += 1;
          job.progress = job.pagesDiscovered > 0 ? Math.round((job.pagesProcessed / job.pagesDiscovered) * 100) : 0;

          if (page.scrapeResult?.ok && page.scrapeResult.data) {
            const parsed = page.scrapeResult.data;

            if (!sellerId) {
              const sellerData = extractSeller(parsed, page.url, source);
              const seller = await upsertSeller({ ...sellerData, sourceUrl });
              sellerId = String(seller._id);
              job.sellerId = seller._id;
            }

            const extractedProducts = extractProducts(parsed, page.url, source);
            for (const prod of extractedProducts) {
              if (prod.name && prod.name !== "Unknown product") {
                productsFound += 1;
                await upsertProduct(sellerId, { ...prod, sourceUrl: prod.sourceUrl || page.url });
                productsProcessed += 1;
              }
            }
          } else if (page.scrapeResult && !page.scrapeResult.ok) {
            // A page can fail (e.g. rate-limited, timed out) without failing the whole job — record
            // it so "completed" doesn't silently mean "completed, minus whatever pages 404'd or 429'd".
            job.errors.push({
              url: page.url,
              type: page.scrapeResult.error?.type ?? "unknown_error",
              message: page.scrapeResult.error?.message ?? "Page scrape failed",
              occurredAt: new Date(),
            });
          }

          job.productsFound = productsFound;
          job.productsProcessed = productsProcessed;
          await job.save();
        }),
    });

    job.pagesDiscovered = summary.pages.length;
    job.pagesProcessed = summary.pages.length;
    job.productsFound = productsFound;
    job.productsProcessed = productsProcessed;
    job.status = "completed";
    job.progress = 100;
    job.completedAt = new Date();
    await job.save();

    logEvent({ event: "JOB_COMPLETED", jobId, url: sourceUrl, status: "completed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    job.status = "failed";
    job.errors.push({ type: "unknown_error", message, occurredAt: new Date() });
    job.completedAt = new Date();
    await job.save();
    logEvent({ event: "JOB_FAILED", jobId, url: sourceUrl, status: "failed", error: message });
    throw error;
  }
}
