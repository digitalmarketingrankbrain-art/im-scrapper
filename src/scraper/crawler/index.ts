import { env } from "@/lib/config/env";
import { logEvent } from "@/lib/logger";
import type { CrawlPage } from "@/types";
import { scrapePage, type ScrapeStaticResult } from "../index";
import { proxyCount } from "../proxy/pool";
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
  onActivity?: (activity: CrawlActivity) => void;
}

/** Human-readable progress note, surfaced live in the UI so a long wait never looks like a hang. */
export interface CrawlActivity {
  message: string;
  level: "info" | "success" | "warn" | "error";
  /** Shown as a live countdown (epoch ms) while every worker is paused. */
  waitUntil?: number;
  /** Only updates the "currently doing" line; not appended to the history. */
  transient?: boolean;
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
const REQUEST_SPACING_MS = 250;
const REQUEST_JITTER_MS = 150;

/**
 * Base pause every worker takes once the target starts returning 429s. It doubles for each
 * consecutive 429 (capped) and resets after a success: a single page's own retry/backoff
 * (see fetcher.ts) can't outlast a session-level rate limit, so the whole crawl backs off instead.
 */
const RATE_LIMIT_COOLDOWN_MS = 8_000;
const MAX_RATE_LIMIT_COOLDOWN_MS = 60_000;

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const label = u.searchParams.get("pn") ?? (u.pathname + u.search);
    return label.length > 70 ? `${label.slice(0, 67)}...` : label;
  } catch {
    return url;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Failures worth another attempt later — a 404, a robots.txt block or a non-HTML page will fail the same way every time. */
export function isRetryableFailure(result: ScrapeStaticResult | undefined): boolean {
  if (!result || result.ok) return false;
  const type = result.error?.type;
  if (type === "rate_limited" || type === "timeout" || type === "network_error" || type === "browser_crash") return true;
  if (type === "unknown_error") return true;
  if (type === "http_error") return (result.httpStatus ?? 0) >= 500;
  // A 403 can be a per-IP block; a different IP may get through, but without rotation retrying is pointless.
  if (type === "access_denied") return result.httpStatus === 403 && proxyCount() > 0;
  return false;
}

/**
 * One crawl of one domain, split into steps the job can report on separately:
 *  - `discover()` walks the site breadth-first and fetches every reachable page once;
 *  - `retryFailed()` goes back over pages that failed for transient reasons (rate limit, crash, timeout)
 *    and continues discovery from any links those pages turn out to hold.
 * Only same-domain http(s) links are followed, deduped by normalized URL, bounded by maxDepth/maxPages.
 * `jobId` on each page is left empty — the job system stamps it when it owns the run.
 */
export class CrawlSession {
  readonly startUrl: string;
  /** Latest result per URL — a successful retry replaces the earlier failure. */
  readonly pages = new Map<string, CrawlResultPage>();

  private readonly queue = new CrawlQueue();
  private readonly allowedHost: string;
  private readonly maxDepth: number;
  private readonly maxPages: number;
  private readonly concurrency: number;
  private readonly onPage?: CrawlOptions["onPage"];
  private readonly onActivity?: CrawlOptions["onActivity"];
  private sitemapPromise: Promise<void> | null;
  /** Shared across every worker — one 429 anywhere pauses all of them. */
  private cooldownUntil = 0;
  private consecutiveRateLimits = 0;
  private readonly recoveredUrls = new Set<string>();

  constructor(startUrl: string, options: CrawlOptions = {}) {
    const normalizedStart = normalizeUrl(startUrl);
    if (!normalizedStart) throw new Error(`Invalid start URL: ${startUrl}`);
    this.startUrl = normalizedStart;
    this.allowedHost = new URL(normalizedStart).hostname;
    this.maxDepth = options.maxDepth ?? env.MAX_CRAWL_DEPTH;
    this.maxPages = options.maxPages ?? env.MAX_PAGES;
    this.concurrency = options.concurrency ?? env.MAX_CONCURRENCY;
    this.onPage = options.onPage;
    this.onActivity = options.onActivity;
    this.queue.enqueue(normalizedStart, 0);
    this.sitemapPromise = options.useSitemap ? this.seedFromSitemap() : null;
  }

  private async seedFromSitemap(): Promise<void> {
    const origin = new URL(this.startUrl).origin;
    for (const rawUrl of await discoverSitemapUrls(origin)) {
      const normalized = normalizeUrl(rawUrl);
      if (normalized && isSameDomain(normalized, this.allowedHost, this.startUrl)) this.queue.enqueue(normalized, 1);
    }
  }

  /** Total distinct URLs seen so far (fetched, failed, or still waiting in the queue). */
  get totalPages(): number {
    return this.queue.visitedCount;
  }

  get pagesRecovered(): number {
    return this.recoveredUrls.size;
  }

  successfulPages(): CrawlResultPage[] {
    return [...this.pages.values()].filter((p) => p.status === "success");
  }

  failedPages(): CrawlResultPage[] {
    return [...this.pages.values()].filter((p) => p.status === "failed");
  }

  retryableFailedPages(): CrawlResultPage[] {
    return this.failedPages().filter((p) => isRetryableFailure(p.scrapeResult));
  }

  toSummary(): CrawlSummary {
    const pages = [...this.pages.values()];
    return {
      startUrl: this.startUrl,
      pages,
      pagesProcessed: pages.filter((p) => p.status === "success").length,
      pagesFailed: pages.filter((p) => p.status === "failed").length,
    };
  }

  private enqueueLinks(page: CrawlResultPage, depth: number): void {
    if (depth >= this.maxDepth) return;
    for (const rawLink of page.scrapeResult?.data?.links ?? []) {
      const normalized = normalizeUrl(rawLink);
      if (normalized && isSameDomain(normalized, this.allowedHost, this.startUrl)) {
        this.queue.enqueue(normalized, depth + 1);
      }
    }
  }

  private noteResult(result: ScrapeStaticResult): void {
    if (result.error?.type === "rate_limited") {
      this.consecutiveRateLimits++;
      const cooldown = Math.min(
        RATE_LIMIT_COOLDOWN_MS * 2 ** (this.consecutiveRateLimits - 1),
        MAX_RATE_LIMIT_COOLDOWN_MS,
      );
      this.cooldownUntil = Math.max(this.cooldownUntil, Date.now() + cooldown);
      this.onActivity?.({
        message: `Rate limited (429) — pausing all requests for ${Math.round(cooldown / 1000)}s`,
        level: "warn",
        waitUntil: this.cooldownUntil,
      });
    } else if (result.ok) {
      this.consecutiveRateLimits = 0;
    }
  }

  private async waitOutCooldown(url: string): Promise<void> {
    const waitMs = this.cooldownUntil - Date.now();
    if (waitMs > 0) {
      this.onActivity?.({
        message: `Waiting out the rate limit (${Math.ceil(waitMs / 1000)}s left)`,
        level: "warn",
        waitUntil: this.cooldownUntil,
        transient: true,
      });
      logEvent({ event: "CRAWL_RATE_LIMIT_COOLDOWN", url, status: "waiting", duration: waitMs });
      await sleep(waitMs);
    }
  }

  private async fetchPage(url: string, depth: number): Promise<CrawlResultPage> {
    logEvent({ event: "CRAWL_PAGE_START", url, status: "processing" });
    this.onActivity?.({ message: `Fetching ${shortUrl(url)}`, level: "info", transient: true });
    const discoveredAt = new Date();
    const scrapeResult = await scrapePage(url, "auto");
    const processedAt = new Date();
    this.noteResult(scrapeResult);

    const page: CrawlResultPage = {
      jobId: "",
      url,
      status: scrapeResult.ok ? "success" : "failed",
      httpStatus: scrapeResult.httpStatus,
      depth,
      error: scrapeResult.error?.message,
      discoveredAt,
      processedAt,
      scrapeResult,
    };
    this.pages.set(url, page);
    logEvent({ event: "CRAWL_PAGE_DONE", url, status: page.status, error: page.error });
    this.onActivity?.(
      page.status === "success"
        ? { message: `Fetched ${shortUrl(url)}${scrapeResult.renderedWith === "dynamic" ? " (browser)" : ""}`, level: "success" }
        : { message: `Failed ${shortUrl(url)} — ${page.error ?? "unknown error"}`, level: "error" },
    );
    return page;
  }

  /** Walks the queue until empty (or maxPages). Failed pages are kept, not retried — see retryFailed(). */
  async discover(): Promise<void> {
    await this.sitemapPromise;
    this.sitemapPromise = null;

    const worker = async () => {
      let firstRequest = true;
      while (this.pages.size < this.maxPages) {
        const item = this.queue.dequeue();
        if (!item) return;
        if (item.depth > this.maxDepth) continue;

        if (!firstRequest) await sleep(REQUEST_SPACING_MS + Math.floor(Math.random() * REQUEST_JITTER_MS));
        firstRequest = false;
        await this.waitOutCooldown(item.url);

        const page = await this.fetchPage(item.url, item.depth);
        if (page.status === "success") this.enqueueLinks(page, item.depth);
        await this.onPage?.(page, this.queue.visitedCount);
      }
    };

    await Promise.all(Array.from({ length: this.concurrency }, worker));
  }

  /**
   * One verification pass: waits out any active rate-limit cooldown, then re-fetches every
   * retryable failed page one at a time (single worker — the first attempt already showed the
   * site can't take parallel load). Pages that now succeed feed their links back into discovery.
   * Returns how many pages were recovered in this pass.
   */
  async retryFailed(round: number): Promise<number> {
    const targets = this.retryableFailedPages();
    if (targets.length === 0) return 0;

    // Each round waits longer than the last: a block that survived 15s may clear after 30s or 60s.
    const roundCooldown = Math.min(RATE_LIMIT_COOLDOWN_MS * 2 ** (round - 1), MAX_RATE_LIMIT_COOLDOWN_MS);
    this.cooldownUntil = Math.max(this.cooldownUntil, Date.now() + roundCooldown);
    logEvent({ event: "CRAWL_VERIFY_ROUND", status: "start", round, duration: roundCooldown, pages: targets.length });
    this.onActivity?.({
      message: `Retry round ${round}: re-fetching ${targets.length} failed page${targets.length > 1 ? "s" : ""} after a ${Math.round(roundCooldown / 1000)}s cooldown`,
      level: "info",
      waitUntil: this.cooldownUntil,
    });

    let recovered = 0;
    for (const target of targets) {
      await this.waitOutCooldown(target.url);
      await sleep(REQUEST_SPACING_MS + Math.floor(Math.random() * REQUEST_JITTER_MS));

      const page = await this.fetchPage(target.url, target.depth);
      if (page.status === "success") {
        recovered++;
        this.recoveredUrls.add(target.url);
        this.enqueueLinks(page, target.depth);
      }
      await this.onPage?.(page, this.queue.visitedCount);
    }

    // Recovered pages may have revealed links that were never reachable before.
    if (recovered > 0) await this.discover();
    return recovered;
  }
}

/** One-shot crawl (discover only) — kept for callers that don't need the verify phase. */
export async function crawl(startUrl: string, options: CrawlOptions = {}): Promise<CrawlSummary> {
  const session = new CrawlSession(startUrl, options);
  await session.discover();
  return session.toSummary();
}
