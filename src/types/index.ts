export type ScrapeSource = "indiamart" | "seller_website";

/** Parsed price, kept alongside the raw string it was parsed from (see Phase 5). */
export interface Money {
  raw: string;
  value: number | null;
  currency: string | null;
  unit: string | null;
}

export interface Address {
  raw?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface ImageRef {
  url: string;
  alt?: string;
  source: "src" | "data-src" | "srcset" | "og" | "json-ld" | "html";
  /** Final public URL (S3) once the image is uploaded — exports prefer this over `url`. */
  storageUrl?: string;
  /** Absolute path of the downloaded file, once the image has been saved to disk. */
  localPath?: string;
  /** Why the download failed, when it did. */
  downloadError?: string;
}

export interface Seller {
  source: ScrapeSource;
  sourceUrl: string;
  name: string;
  description?: string;
  businessType?: string;
  phone?: string[];
  email?: string[];
  address?: Address;
  website?: string;
  categories?: string[];
  gstNumber?: string;
  yearOfEst?: string;
  trustSeal?: boolean;
  metadata?: Record<string, unknown>;
  scrapedAt: Date;
  updatedAt: Date;
}

export interface Product {
  sellerId: string;
  source: ScrapeSource;
  sourceUrl: string;
  name: string;
  description?: string;
  category?: string;
  subCategory?: string;
  price?: Money;
  minimumOrderQuantity?: string;
  specifications?: Record<string, string>;
  keyFeatures?: Record<string, string>;
  brand?: string;
  model?: string;
  images: ImageRef[];
  metadata?: Record<string, unknown>;
  scrapedAt: Date;
  updatedAt: Date;
}

export type ScrapeJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type CrawlErrorType =
  | "network_error"
  | "rate_limited"
  | "browser_crash"
  | "timeout"
  | "http_error"
  | "parsing_error"
  | "validation_error"
  | "unsupported_page"
  | "access_denied"
  | "unknown_error";

export interface ScrapeError {
  url?: string;
  type: CrawlErrorType;
  message: string;
  occurredAt: Date;
}

/** Which stage of the discover -> scrape -> verify workflow a running job is in. */
export type ScrapePhase = "discovering" | "scraping" | "verifying" | "downloading" | "done";

export interface ScrapeJob {
  sourceUrl: string;
  sellerId?: string;
  status: ScrapeJobStatus;
  phase?: ScrapePhase;
  progress: number;
  /** Total pages found. Settled once discovery ends; only grows afterwards if a retried page reveals new links. */
  pagesDiscovered: number;
  pagesProcessed: number;
  /** Pages that failed (rate limit, crash, timeout...) at least once and were later fetched successfully. */
  pagesRecovered?: number;
  /** Pages still failing after every verification round. */
  pagesFailed?: number;
  retryRound?: number;
  /** Distinct products found across all fetched pages. */
  productsFound: number;
  productsProcessed: number;
  /** Products found on a page but not saved to the database after verification. */
  productsMissing?: number;
  imagesTotal?: number;
  imagesDownloaded?: number;
  imagesFailed?: number;
  errors: ScrapeError[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CrawlPageStatus =
  | "queued"
  | "processing"
  | "success"
  | "failed"
  | "skipped";

export interface CrawlPage {
  jobId: string;
  url: string;
  status: CrawlPageStatus;
  httpStatus?: number;
  depth: number;
  pageType?: string;
  error?: string;
  discoveredAt: Date;
  processedAt?: Date;
}
