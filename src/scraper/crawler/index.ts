import { env } from "@/lib/config/env";
import { logEvent } from "@/lib/logger";
import type { CrawlPage } from "@/types";
import { scrapePage, type ScrapeStaticResult } from "../index";
import { isSameDomain } from "./domainPolicy";
import { normalizeUrl } from "./normalizeUrl";
import { CrawlQueue } from "./queue";
import { discoverSitemapUrls } from "./sitemap";

export interface CrawlOptions {
  maxDepth?: number;
  maxPages?: number;
  concurrency?: number;
  useSitemap?: boolean;
  /** Called as each page finishes (success or fail), so callers can track live progress instead of waiting for the whole crawl. `discovered` is the running total of distinct URLs found so far. */
  onPage?: (page: CrawlResultPage, discovered: number) => void | Promise<void>;
}

export interface CrawlResultPage extends CrawlPage {
  scrapeResult?: ScrapeStaticResult;
}

export interface CrawlSummary {
  startUrl: string;
  pages: CrawlResultPage[];
  pagesProcessed: number;
  pagesFailed: number;
}

/** Politeness delay between requests from a single worker — don't hammer the target site. */
const REQUEST_SPACING_MS = 150;

/**
 * How long every worker pauses once the target starts returning 429s. A single page's own
 * retry/backoff (see fetcher.ts) can't outlast a session-level rate limit — it just burns through
 * its attempts against a block that's still active. Pausing the whole crawl gives that block time
 * to lift before any worker tries again.
 */
const RATE_LIMIT_COOLDOWN_MS = 20_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Breadth-first crawl of one domain: discovers links from each successfully scraped page,
 * follows only same-domain http(s) links, dedups by normalized URL, stops at maxDepth/maxPages.
 * `jobId` on each page is left empty here — the Phase 7 job system stamps it when it owns the run.
 */
export async function crawl(startUrl: string, options: CrawlOptions = {}): Promise<CrawlSummary> {
  const maxDepth = options.maxDepth ?? env.MAX_CRAWL_DEPTH;
  const maxPages = options.maxPages ?? env.MAX_PAGES;
  const concurrency = options.concurrency ?? env.MAX_CONCURRENCY;

  const normalizedStart = normalizeUrl(startUrl);
  if (!normalizedStart) throw new Error(`Invalid start URL: ${startUrl}`);
  const startUrlStr: string = normalizedStart;
  const allowedHost = new URL(startUrlStr).hostname;

  const queue = new CrawlQueue();
  queue.enqueue(normalizedStart, 0);

  if (options.useSitemap) {
    const origin = new URL(normalizedStart).origin;
    for (const rawUrl of await discoverSitemapUrls(origin)) {
      const normalized = normalizeUrl(rawUrl);
      if (normalized && isSameDomain(normalized, allowedHost, startUrlStr)) queue.enqueue(normalized, 1);
    }
  }

  const pages: CrawlResultPage[] = [];
  let pagesProcessed = 0;
  let pagesFailed = 0;
  /** Shared across every worker in this crawl — one 429 anywhere pauses all of them. */
  let cooldownUntil = 0;

  async function worker() {
    let firstRequest = true;
    while (pages.length < maxPages) {
      const item = queue.dequeue();
      if (!item) return;
      if (item.depth > maxDepth) continue;

      if (!firstRequest) await sleep(REQUEST_SPACING_MS);
      firstRequest = false;

      const waitMs = cooldownUntil - Date.now();
      if (waitMs > 0) {
        logEvent({ event: "CRAWL_RATE_LIMIT_COOLDOWN", url: item.url, status: "waiting", duration: waitMs });
        await sleep(waitMs);
      }

      logEvent({ event: "CRAWL_PAGE_START", url: item.url, status: "processing" });
      const discoveredAt = new Date();
      const scrapeResult = await scrapePage(item.url, "auto");
      const processedAt = new Date();

      if (scrapeResult.httpStatus === 429) {
        cooldownUntil = Math.max(cooldownUntil, Date.now() + RATE_LIMIT_COOLDOWN_MS);
      }

      const page: CrawlResultPage = {
        jobId: "",
        url: item.url,
        status: scrapeResult.ok ? "success" : "failed",
        httpStatus: scrapeResult.httpStatus,
        depth: item.depth,
        error: scrapeResult.error?.message,
        discoveredAt,
        processedAt,
        scrapeResult,
      };
      pages.push(page);

      if (scrapeResult.ok) {
        pagesProcessed++;
        if (item.depth < maxDepth) {
          for (const rawLink of scrapeResult.data?.links ?? []) {
            const normalized = normalizeUrl(rawLink);
            if (normalized && isSameDomain(normalized, allowedHost, startUrlStr)) {
              queue.enqueue(normalized, item.depth + 1);
            }
          }
        }
      } else {
        pagesFailed++;
      }

      logEvent({ event: "CRAWL_PAGE_DONE", url: item.url, status: page.status, error: page.error });
      await options.onPage?.(page, queue.visitedCount);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));

  return { startUrl: normalizedStart, pages, pagesProcessed, pagesFailed };
}
