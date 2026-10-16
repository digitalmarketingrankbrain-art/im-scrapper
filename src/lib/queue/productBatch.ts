import { env } from "@/lib/config/env";
import { logEvent } from "@/lib/logger";
import { productKeyUrl } from "@/scraper/extract/mergeDetail";
import type { SingleProductResult } from "@/scraper/product/scrapeSingleProduct";
import type { CrawlErrorType, SkipReason } from "@/types";

type Saveable = Extract<SingleProductResult, { status: "ok" }>;

export interface BatchDeps {
  scrape: (url: string) => Promise<SingleProductResult>;
  /** Persists one valid product. May throw — that product counts as failed and the batch carries on. */
  save: (result: Saveable) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  /** Pause between two product pages — the site answers 429s to a request flood. */
  spacingMs?: number;
}

export interface BatchFailure {
  url: string;
  type: CrawlErrorType;
  message: string;
  retryable: boolean;
}

export interface BatchSkip {
  url: string;
  reason: SkipReason;
  message: string;
}

export interface BatchSummary {
  total: number;
  saved: number;
  skipped: BatchSkip[];
  failed: BatchFailure[];
}

export interface BatchHooks {
  /** Called after every product settles, whatever the outcome. */
  onProgress?: (summary: BatchSummary, done: number, url: string) => void | Promise<void>;
  onNote?: (message: string, level: "info" | "warn" | "error") => void | Promise<void>;
}

const RETRY_COOLDOWN_MS = 15_000;
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One URL per product: the same product reached by two different links is processed once. */
export function dedupeProductUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  return urls.filter((url) => {
    const key = productKeyUrl(url) ?? url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Runs the common single-product scraper over a list of URLs, one at a time:
 *   valid → saved · too few specs → skipped · anything else goes wrong → logged and the loop moves on.
 * Failures that look temporary (rate limit, timeout, 5xx) get a few more rounds after a cooldown.
 */
export async function runProductBatch(urls: string[], deps: BatchDeps, hooks: BatchHooks = {}): Promise<BatchSummary> {
  const sleep = deps.sleep ?? defaultSleep;
  const spacing = deps.spacingMs ?? 300;
  const queue = dedupeProductUrls(urls);
  const summary: BatchSummary = { total: queue.length, saved: 0, skipped: [], failed: [] };
  /** Products with a final outcome. A product waiting for a retry is not done yet, so the bar never runs ahead of the saved count. */
  const settled = () => summary.saved + summary.skipped.length + summary.failed.length;

  const processOne = async (url: string): Promise<BatchFailure | undefined> => {
    let failure: BatchFailure | undefined;
    try {
      const result = await deps.scrape(url);
      if (result.status === "skipped") {
        summary.skipped.push({ url, reason: result.reason, message: result.message });
        logEvent({ event: "PRODUCT_SKIPPED", url, status: "skipped", reason: result.reason, specs: result.specCount });
      } else if (result.status === "failed") {
        failure = { url, type: result.error.type, message: result.error.message, retryable: result.retryable };
      } else {
        try {
          await deps.save(result);
          summary.saved++;
          logEvent({ event: "PRODUCT_SAVED", url, status: "saved", specs: result.specCount });
        } catch (error) {
          failure = { url, type: "unknown_error", message: `Could not save: ${error instanceof Error ? error.message : String(error)}`, retryable: true };
        }
      }
    } catch (error) {
      // scrapeSingleProduct does not throw, but a failing product must never end the batch whatever the cause.
      failure = { url, type: "unknown_error", message: error instanceof Error ? error.message : String(error), retryable: false };
    }
    if (failure) logEvent({ event: "PRODUCT_FAILED", url, status: "failed", type: failure.type, error: failure.message });
    return failure;
  };

  const retryQueue: string[] = [];
  const lastFailure = new Map<string, BatchFailure>();
  for (const [index, url] of queue.entries()) {
    if (index > 0) await sleep(spacing + Math.floor(Math.random() * spacing));
    const failure = await processOne(url);
    if (failure) {
      if (failure.retryable) {
        retryQueue.push(url);
        lastFailure.set(url, failure);
      } else summary.failed.push(failure);
    }
    await hooks.onProgress?.(summary, settled(), url);
  }

  // Temporary failures: a block per IP usually lifts within minutes, so each round waits longer than the last.
  let pending = retryQueue;
  for (let round = 1; round <= env.MAX_VERIFY_ROUNDS && pending.length > 0; round++) {
    await hooks.onNote?.(`Retry round ${round}: ${pending.length} product${pending.length > 1 ? "s" : ""} failed temporarily — waiting ${Math.round((RETRY_COOLDOWN_MS * round) / 1000)}s`, "warn");
    await sleep(RETRY_COOLDOWN_MS * round);
    const stillFailing: string[] = [];
    for (const [index, url] of pending.entries()) {
      if (index > 0) await sleep(spacing + Math.floor(Math.random() * spacing));
      const failure = await processOne(url);
      if (failure) {
        lastFailure.set(url, failure);
        stillFailing.push(url);
      }
      await hooks.onProgress?.(summary, settled(), url);
    }
    pending = stillFailing;
  }
  for (const url of pending) summary.failed.push(lastFailure.get(url)!);

  await hooks.onProgress?.(summary, settled(), "");
  return summary;
}
