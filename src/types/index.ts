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
  source: "src" | "data-src" | "srcset" | "og" | "json-ld";
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

export interface ScrapeJob {
  sourceUrl: string;
  sellerId?: string;
  status: ScrapeJobStatus;
  progress: number;
  pagesDiscovered: number;
  pagesProcessed: number;
  productsFound: number;
  productsProcessed: number;
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
