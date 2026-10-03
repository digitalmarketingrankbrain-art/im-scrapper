import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Crawl-wide limits — enforced starting Phase 4, safe defaults defined now
  MAX_CRAWL_DEPTH: z.coerce.number().int().positive().default(3),
  MAX_PAGES: z.coerce.number().int().positive().default(50),
  MAX_PRODUCTS: z.coerce.number().int().positive().default(200),
  // Kept low by default — sites like IndiaMart start returning 429s well before 6 parallel
  // requests, and the crawler's own cooldown (see crawler/index.ts) can't undo a block that
  // a too-eager default concurrency keeps re-triggering.
  MAX_CONCURRENCY: z.coerce.number().int().positive().default(3),

  // Per-request limits — used from Phase 2 (src/scraper/fetcher.ts)
  REQUEST_TIMEOUT: z.coerce.number().int().positive().default(15000),
  RETRY_LIMIT: z.coerce.number().int().min(0).default(2),

  // IP rotation — comma/newline separated proxy URLs (http://user:pass@host:port). Empty = direct connection.
  PROXY_URLS: z.string().optional(),
  // How many times the verify phase re-fetches pages that failed (rate limit, crash, timeout).
  MAX_VERIFY_ROUNDS: z.coerce.number().int().min(0).default(3),

  // Background jobs — used starting Phase 7, unset until Redis is added
  REDIS_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env = parsed.data;
