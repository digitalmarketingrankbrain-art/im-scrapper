import { env } from "@/lib/config/env";
import type { ScrapeJobMode } from "@/types";
import { CrawlSession, type CrawlActivity, type CrawlResultPage } from "../crawler";
import { normalizeUrl } from "../crawler/normalizeUrl";
import { isProductDetailPage, productKeyUrl } from "../extract/mergeDetail";
import { scrapePage } from "../index";
import type { ParsedPage } from "../static/parseHtml";

/**
 * URL discovery only. Everything here ends in a list of product-page URLs; turning a URL into a
 * product record is `scrapeSingleProduct`'s job, for every mode alike.
 */

const LISTING_PATHS = new Set(["impcat", "search.mp", "dir", "cities", "products", "catalog"]);
/** Storefront sections that describe the seller — no products on them. */
const SELLER_SECTION_RE = /^(testimonial|aboutus|videos|photos|enquiry|contactus|profile|sitemap)$/i;

/** Which of the three flows a URL belongs to. The user can always override it explicitly. */
export function detectScrapeMode(rawUrl: string): ScrapeJobMode {
  const url = new URL(rawUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  const first = (segments[0] ?? "").toLowerCase();

  if (first === "proddetail") return "product";
  // A store link to one product (`/<store>/?pid=<id>&pn=...`).
  if (url.searchParams.has("pid") && url.hostname.includes("indiamart.com")) return "product";
  if (url.hostname.toLowerCase().startsWith("dir.") || LISTING_PATHS.has(first)) return "listing";
  return "catalog";
}

export interface DiscoveryHooks {
  concurrency?: number;
  onActivity?: (activity: CrawlActivity) => void;
  onPage?: (page: CrawlResultPage, discovered: number) => void | Promise<void>;
}

export interface DiscoveryResult {
  /** Distinct product-page URLs, one per product, in the order they were found. */
  urls: string[];
  pagesDiscovered: number;
  pagesProcessed: number;
  failedPages: { url: string; type: string; message: string }[];
}

/** Product-page links on one fetched page: anchors plus the URLs inside IndiaMart's embedded listing data. */
export function collectProductUrls(parsed: ParsedPage, pageUrl: string): string[] {
  const candidates = [...parsed.links];
  const data = (parsed.nextData as { props?: { pageProps?: { serviceRes?: { Data?: unknown } } } } | undefined)?.props?.pageProps?.serviceRes?.Data;
  if (Array.isArray(data)) {
    for (const item of data as Record<string, unknown>[]) {
      for (const field of ["PDP_CANONICAL_URL", "PRD_URL", "PC_ITEM_URL"]) {
        if (typeof item?.[field] === "string") candidates.push(item[field] as string);
      }
    }
  }

  const found = new Map<string, string>();
  for (const raw of candidates) {
    const url = normalizeUrl(raw, pageUrl);
    if (!url || !isProductDetailPage(url)) continue;
    // Same product linked twice (card + title) or with different tracking params counts once.
    const key = productKeyUrl(url) ?? url;
    if (!found.has(key)) found.set(key, url);
  }
  return [...found.values()];
}

function mergeUrls(into: Map<string, string>, urls: string[]) {
  for (const url of urls) {
    const key = productKeyUrl(url) ?? url;
    if (!into.has(key)) into.set(key, url);
  }
}

/**
 * MODE 2 — a seller's catalog. Walks the seller's own store pages (category pages, "Products & Services")
 * with the regular crawler — same rate-limit handling and retries — but never opens a product page itself.
 */
export async function discoverCatalogProductUrls(startUrl: string, hooks: DiscoveryHooks = {}): Promise<DiscoveryResult> {
  const session = new CrawlSession(startUrl, {
    concurrency: hooks.concurrency,
    onActivity: hooks.onActivity,
    onPage: hooks.onPage,
    shouldFollow: (url) => {
      if (isProductDetailPage(url)) return false;
      const last = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
      return !SELLER_SECTION_RE.test(last.replace(/\.html?$/i, ""));
    },
  });
  await session.discover();

  for (let round = 1; round <= env.MAX_VERIFY_ROUNDS && session.retryableFailedPages().length > 0; round++) {
    const recovered = await session.retryFailed(round);
    if (recovered === 0 && session.lastRoundBlocked) break;
  }

  const urls = new Map<string, string>();
  for (const page of session.successfulPages()) {
    if (page.scrapeResult?.data) mergeUrls(urls, collectProductUrls(page.scrapeResult.data, page.url));
  }
  return {
    urls: [...urls.values()].slice(0, env.MAX_PRODUCTS),
    pagesDiscovered: Math.max(session.totalPages, session.pages.size),
    pagesProcessed: session.pages.size,
    failedPages: session.failedPages().map((p) => ({
      url: p.url,
      type: p.scrapeResult?.error?.type ?? "unknown_error",
      message: p.scrapeResult?.error?.message ?? "Page scrape failed",
    })),
  };
}

/** MODE 3 — a category / product-type listing. Reads that one page and collects the products it lists. */
export async function discoverListingProductUrls(pageUrl: string, hooks: DiscoveryHooks = {}): Promise<DiscoveryResult> {
  hooks.onActivity?.({ message: `Fetching listing ${pageUrl}`, level: "info", transient: true });
  let result = await scrapePage(pageUrl, "auto");
  // Patient retries for a rate limit — the page is the whole job, so a single failure shouldn't end it.
  for (let attempt = 1; !result.ok && result.error?.type === "rate_limited" && attempt <= env.MAX_VERIFY_ROUNDS; attempt++) {
    hooks.onActivity?.({ message: `Rate limited — retrying the listing in ${attempt * 15}s`, level: "warn" });
    await new Promise((resolve) => setTimeout(resolve, attempt * 15_000));
    result = await scrapePage(pageUrl, "auto");
  }

  if (!result.ok || !result.data) {
    return {
      urls: [],
      pagesDiscovered: 1,
      pagesProcessed: 0,
      failedPages: [{ url: pageUrl, type: result.error?.type ?? "unknown_error", message: result.error?.message ?? "Page scrape failed" }],
    };
  }
  const urls = collectProductUrls(result.data, pageUrl).slice(0, env.MAX_PRODUCTS);
  hooks.onActivity?.({ message: `Found ${urls.length} product links on the listing`, level: "success" });
  return { urls, pagesDiscovered: 1, pagesProcessed: 1, failedPages: [] };
}

/** MODE 1 — the URL already is the product. */
export function discoverSingleProductUrl(productUrl: string): DiscoveryResult {
  return { urls: [productUrl], pagesDiscovered: 0, pagesProcessed: 0, failedPages: [] };
}

export function discoverProductUrls(mode: ScrapeJobMode, url: string, hooks: DiscoveryHooks = {}): Promise<DiscoveryResult> {
  if (mode === "product") return Promise.resolve(discoverSingleProductUrl(url));
  return mode === "catalog" ? discoverCatalogProductUrls(url, hooks) : discoverListingProductUrls(url, hooks);
}
