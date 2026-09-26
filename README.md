# IndiaMart Seller Scraper

A platform that extracts structured seller and product data from an IndiaMART seller URL (and, where publicly available and permitted, the seller's own website).

This project respects target sites' Terms of Service, `robots.txt`, and rate limits. It does not implement CAPTCHA bypass, anti-bot evasion, or stealth techniques — pages that deny access are recorded as failures, not circumvented.

## Tech stack

- **App:** Next.js (App Router) + TypeScript — single app, UI and API routes together
- **Database:** MongoDB, accessed through Mongoose
- **Scraping:** Cheerio (static HTML) + Playwright (JS-rendered pages)
- **Crawling:** BFS same-domain crawler with dedup, depth/page limits, sitemap discovery
- **Jobs:** Redis + BullMQ background job queue
- **Styling:** Tailwind CSS
- **Config/validation:** Zod
- **Logging:** Pino (structured JSON logs)
- **State:** Redux Toolkit (UI state only — selected job, active tab) + TanStack React Query (server state: jobs, results, caching, polling)
- **Testing:** Vitest (unit) + Playwright (E2E dashboard tests)

## Project structure

```
src/
  app/                    Next.js routes — pages and API route handlers
    page.tsx              Dashboard: submit URL, watch progress, view seller/products, export
    providers.tsx          Redux Provider + React Query QueryClientProvider
    error.tsx               Route-level error boundary (Next.js error.js convention)
    api/health/           GET /api/health — DB connectivity check
    api/scrape/           GET /api/scrape?url=&mode= — single-page scrape verification endpoint
    api/jobs/              POST create job, GET list
    api/jobs/[id]/          GET job status
    api/jobs/[id]/results/  GET seller + products for a completed job
    api/jobs/[id]/export/   GET ?format=json|csv — export a job's results
  components/              ScrapeForm, JobProgressCard, SellerDetails, ProductsTable, ResultsTabs,
                            RecentJobsList, DashboardErrorBoundary (component-level error boundary)
  hooks/                   React Query hooks: useRecentJobs, useJob, useJobResults, useCreateJob
  store/                   Redux Toolkit: store, uiSlice (selectedJobId, activeTab), typed hooks
  lib/
    config/env.ts          Validated environment configuration (Zod)
    db/connect.ts          Mongoose connection (singleton, safe across hot-reloads)
    db/models/              Seller, Product, ScrapeJob, CrawlPage Mongoose schemas
    db/repositories.ts      upsertSeller / upsertProduct (keyed on sourceUrl)
    queue/                   BullMQ connection, queue, worker, job-processing pipeline
    export/csv.ts            CSV serialization (formula-injection safe)
    logger.ts                Structured logger + logEvent() helper
  types/                    Shared TypeScript interfaces (Seller, Product, ScrapeJob, CrawlPage, ...)
  scraper/
    fetcher.ts               Static (Cheerio-path) fetch: timeout, retry, access-denied handling
    robots.ts                 robots.txt compliance check
    static/                    Cheerio-based generic HTML parsing (incl. link extraction)
    dynamic/                   Playwright rendering (browser singleton, page render, route-level SSRF guard)
    crawler/                   BFS crawl: URL normalize/dedup, domain policy, sitemap, queue
    extract/                   Seller/Product extraction (JSON-LD primary, meta-tag fallback)
    normalize/                 Price/phone/email/address normalizers
    security/                  SSRF guard (ssrf.ts) + redirect-safe fetch (safeFetch.ts)
    index.ts                   scrapePage(url, mode) — static/dynamic/auto entry point
  worker.ts                  Standalone BullMQ worker process entrypoint (npm run worker)
docker-compose.yml          Local MongoDB + Redis containers
```

## Getting started

1. Copy the env file and adjust if needed:
   ```
   cp .env.example .env.local
   ```
2. Start MongoDB and Redis:
   ```
   docker compose up -d
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Run the app and the background worker (two separate processes):
   ```
   npm run dev      # Next.js app — http://localhost:3002
   npm run worker   # BullMQ worker — processes scrape jobs
   ```
   (3000/3001 are already used by other local projects on this machine, hence port 3002.)
5. Open `http://localhost:3002`, submit a URL, and watch it scrape.

## Testing

```
npm run test       # Vitest — unit tests for normalization, crawler, robots.txt, CSV export
npm run test:e2e   # Playwright — dashboard UI/feature tests (mocked API routes)
npm run lint
npm run build
```

## Status

See [handover.md](handover.md) for current build phase, decisions made, and what's next.
