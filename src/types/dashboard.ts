export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface ScrapeJobView {
  _id: string;
  sourceUrl: string;
  status: JobStatus;
  progress: number;
  pagesDiscovered: number;
  pagesProcessed: number;
  productsFound: number;
  productsProcessed: number;
  errors: { message: string; url?: string }[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface SellerView {
  name: string;
  description?: string;
  businessType?: string;
  phone?: string[];
  email?: string[];
  website?: string;
  address?: { raw?: string; street?: string; city?: string; state?: string; postalCode?: string; country?: string };
  categories?: string[];
  gstNumber?: string;
  yearOfEst?: string;
  trustSeal?: boolean;
  sourceUrl?: string;
}

export interface ProductView {
  _id: string;
  name: string;
  category?: string;
  brand?: string;
  price?: { raw: string };
  sourceUrl: string;
  minimumOrderQuantity?: string;
  specifications?: Record<string, string>;
  images?: { url: string }[];
}

export interface JobResultsView {
  job: ScrapeJobView;
  seller: SellerView | null;
  products: ProductView[];
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface SellerListItem {
  _id: string;
  name: string;
  businessType?: string;
  address?: { raw?: string; city?: string; state?: string; country?: string };
  website?: string;
  phone?: string[];
  email?: string[];
  categories?: string[];
  productCount: number;
  sourceUrl: string;
  scrapedAt: string;
}

export interface ProductListItem {
  _id: string;
  name: string;
  category?: string;
  subCategory?: string;
  brand?: string;
  price?: { raw: string };
  minimumOrderQuantity?: string;
  images: { url: string }[];
  sourceUrl: string;
  sellerId?: string;
  sellerName?: string;
  scrapedAt: string;
}

export interface ProductDetailView extends ProductListItem {
  description?: string;
  model?: string;
  specifications?: Record<string, string>;
  seller: SellerListItem | null;
}

export const ACTIVE_JOB_STATUSES = new Set<JobStatus>(["pending", "running"]);

export interface NamedCount {
  name: string;
  count: number;
}

export interface JobsTrendPoint {
  date: string;
  count: number;
}

export interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface DashboardStats {
  jobs: {
    total: number;
    byStatus: Record<JobStatus, number>;
    successRate: number | null;
    avgDurationMs: number | null;
    totalPagesProcessed: number;
    totalProductsFound: number;
    trend: JobsTrendPoint[];
  };
  catalog: {
    totalProducts: number;
    totalSellers: number;
    topCategories: NamedCount[];
    topBrands: NamedCount[];
  };
  errors: NamedCount[];
  queue: QueueCounts | null;
}
