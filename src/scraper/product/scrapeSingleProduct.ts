import { logEvent } from "@/lib/logger";
import type { CrawlErrorType, Product, ScrapeSource, Seller, SkipReason } from "@/types";
import { isRetryableFailure } from "../crawler";
import { extractProductDetail, looksLikeProductPage, MIN_SPECS } from "../extract/productDetail";
import { mergeStorePage } from "../extract/seller";
import { scrapePage, type ScrapeStaticResult } from "../index";

/** About Us HTML per seller store, so a catalog of 200 products reads each seller's page once. */
export type SellerPageCache = Map<string, Promise<string | undefined>>;

export interface ScrapeSingleProductOptions {
  /** Share one cache across a whole job. */
  sellerPages?: SellerPageCache;
  /** Look at the seller's own page for extra (non-contact) facts. Default true. */
  checkSellerPage?: boolean;
  /** Test seam — defaults to the real fetcher. */
  fetchPage?: (url: string, mode: "static" | "auto") => Promise<ScrapeStaticResult>;
}

export type SingleProductResult =
  | {
      status: "ok";
      url: string;
      product: Partial<Product>;
      seller: Partial<Seller>;
      specCount: number;
      breadcrumb: string[];
    }
  | { status: "skipped"; url: string; reason: SkipReason; specCount: number; message: string }
  | { status: "failed"; url: string; error: { type: CrawlErrorType; message: string }; retryable: boolean };

function sourceFromUrl(url: string): ScrapeSource {
  return new URL(url).hostname.includes("indiamart.com") ? "indiamart" : "seller_website";
}

/** The seller's About Us page: that is where IndiaMart keeps the factsheet (legal status, turnover, employees, year). */
async function loadSellerPage(storeUrl: string, opts: ScrapeSingleProductOptions): Promise<string | undefined> {
  const cache = opts.sellerPages;
  const cached = cache?.get(storeUrl);
  if (cached) return cached;
  const fetchPage = opts.fetchPage ?? scrapePage;
  const pending = fetchPage(`${storeUrl}aboutus.html`, "static")
    .then((r) => (r.ok ? r.data?.rawHtml : undefined))
    .catch(() => undefined);
  cache?.set(storeUrl, pending);
  return pending;
}

/**
 * The one place a product page is turned into a record — URL discovery for catalogs and listings only
 * finds URLs and hands each one here.
 *
 *   fetch → is it a product page? → specs >= MIN_SPECS? (else SKIP, before any image/seller work)
 *         → images (max 5) → seller block → seller's own page for extra facts → breadcrumb → result
 *
 * Never throws: a failing page comes back as `{ status: "failed" }` so a batch can log it and carry on.
 */
export async function scrapeSingleProduct(url: string, opts: ScrapeSingleProductOptions = {}): Promise<SingleProductResult> {
  try {
    const fetchPage = opts.fetchPage ?? scrapePage;
    const page = await fetchPage(url, "auto");
    if (!page.ok || !page.data) {
      return {
        status: "failed",
        url,
        error: page.error ?? { type: "unknown_error", message: "Page returned no data" },
        retryable: isRetryableFailure(page),
      };
    }

    if (!looksLikeProductPage(page.data, url)) {
      return { status: "skipped", url, reason: "not_a_product_page", specCount: 0, message: "Not a product page" };
    }

    const detail = extractProductDetail(page.data, url, sourceFromUrl(url));

    if (detail.specCount < MIN_SPECS) {
      return {
        status: "skipped",
        url,
        reason: "too_few_specs",
        specCount: detail.specCount,
        message: `Only ${detail.specCount} specification${detail.specCount === 1 ? "" : "s"} (need ${MIN_SPECS}+)`,
      };
    }

    if (!detail.product.name || detail.product.name === "Unknown product") {
      return { status: "failed", url, error: { type: "parsing_error", message: "Product name not found on page" }, retryable: false };
    }
    if (!detail.seller) {
      return { status: "failed", url, error: { type: "parsing_error", message: "Seller details not found on page" }, retryable: false };
    }

    let seller = detail.seller.seller;
    if (opts.checkSellerPage !== false && detail.seller.storeUrl) {
      try {
        seller = mergeStorePage(seller, await loadSellerPage(detail.seller.storeUrl, opts));
      } catch (error) {
        // Extra seller facts are a bonus — the product is still good without them.
        logEvent({ event: "SELLER_PAGE_FAILED", url: detail.seller.storeUrl, error: String(error) });
      }
    }

    return { status: "ok", url, product: detail.product, seller, specCount: detail.specCount, breadcrumb: detail.breadcrumb };
  } catch (error) {
    return {
      status: "failed",
      url,
      error: { type: "unknown_error", message: error instanceof Error ? error.message : String(error) },
      retryable: false,
    };
  }
}
