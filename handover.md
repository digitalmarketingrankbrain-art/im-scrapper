# Handover — IndiaMart Seller Data Extraction Platform

> Is file ko har session ke start mein padho. Yahan project ka current status, decisions, aur "next kya karna hai" likha rehta hai — taaki pura project baar-baar analyze na karna pade.

## Working style (important)

Ye ek learning project hai. Claude ko khud se sab kuch implement NAHI karna — har important decision (architecture, library choice, schema design, UI, etc.) user se ek-ek karke poochna hai (AskUserQuestion ya plain text se), taaki user apni skills grow kar sake. Sirf mechanical/boilerplate setup (jo decision nahi hai) khud se karna theek hai — jaise scaffolding commands chalana, config files likhna jo already decide ho chuka hai. Agar kuch ambiguous ho lekin blocking na ho, ek reasonable engineering assumption le ke explicitly state karo, rukhna zaroori nahi.

**2026-09-16 se ye project ek formal 10-phase build plan follow kar raha hai** (full spec user ne diya, isi conversation mein hai). Rules:
- **Phase-by-phase kaam karna hai, ek response mein poora project nahi.** Har phase se pehle: architecture explain karo, folder structure dikhao, tradeoffs batao, phir implement karo. Complete files dikhao, fragments nahi. Files created/modified clearly list karo.
- **User se explicit "continue"/agle phase ka ishara mile bina agla phase shuru mat karo.**
- Legal/ethical guardrails (non-negotiable): CAPTCHA/auth/paywall/anti-bot bypass nahi, robots.txt aur ToS respect karo, rate-limit karo, access denied pe gracefully fail karo (bypass mat karo), koi stealth/evasion technique nahi.

**2026-09-18 override:** User ne (do baar explicitly poochne ke baad, AskUserQuestion se confirm karke) is phase-gate rule ko **is ek task ke liye** override kiya aur bola "baki saara kaam kro" — Claude ne Phase 3 se Phase 10 tak sab kuch ek hi session mein, khud engineering decisions leke, bina beech mein rukey implement kiya. Ye ek one-time override tha, standing preference nahi — agle kaam ke liye phase-gate rule wapas default hai jab tak user phir se explicitly na bole.

**2026-09-18, isi session mein dusra explicit "bina ruke sab karo" instruction:** User ne frontend ko optimize karne, components mein split karne, error boundary + lazy loading + Redux + React Query add karne, aur Playwright se poora UI test karke result kharab ho to fix-retest loop chalane ko bola — phir se bina beech mein poochhe. Yeh Phase 8 ke baad ka additional frontend-hardening pass tha, formal 10-phase list ka hissa nahi. Redux ka use scope specifically flag kiya gaya (neeche dekho) kyunki is chhote single-page dashboard ke liye technically zaroori nahi tha — phir bhi user ke explicit ask par add kiya gaya, sirf UI-state ke liye (server-state duplicate na ho).

Phase list: 1) Architecture + setup, 2) Cheerio static scraper, 3) Playwright integration, 4) Crawler (discovery/dedup/domain policy/depth/pagination), 5) Extraction/normalization, 6) MongoDB persistence (models), 7) Job system (Redis+BullMQ), 8) Frontend dashboard, 9) Exports (JSON/CSV), 10) Testing + security + hardening.

## Tech stack (decided)

- **Single Next.js app (App Router) + TypeScript** — UI aur API routes dono isi mein hain. (2026-09-16 ko decide hua — pehle Express `backend/` + Next.js `frontend/` split tha, ab merge kar diya gaya kyunki user ka naya spec sirf Next.js list karta hai aur Express mention hi nahi karta.)
- **Database:** MongoDB (via Docker), accessed through **Mongoose**
- **Scraping:** Cheerio (static HTML ke liye) + Playwright (JS-rendered pages ke liye)
- **Styling:** Tailwind CSS
- **Validation/config:** Zod
- **Logging:** Pino (structured JSON logs)
- **Baad mein:** Redis + BullMQ (background job queue, Phase 7)
- **Package manager:** npm
- **Structure:** Single repo, root pe hi Next.js app (`src/app`, `src/lib`, `src/types`, `src/scraper`) — ab `frontend/`/`backend/` subfolders nahi hain.

## Project location

`C:\Users\abc\Desktop\indiamart-scraper\`

Note: Desktop pe ek **purana, alag** IndiaMart scraper project bhi hai (`C:\Users\abc\Desktop\scrapper\` — NestJS + Next.js, 100+ commits, already mature). User ne explicitly is naye project ko **scratch se, alag** banane ka decide kiya (2026-09-14) — purane wale ko touch nahi karna.

## Ports (important — is machine pe bahut saare dev servers already chalte hain)

Default ports (3000, 4000, 5000) already doosre projects ne le rakhe the, isliye:
- **App (dev + start):** `http://localhost:3002` (`next dev -p 3002` / `next start -p 3002`, `package.json` scripts mein set hai)

Agar future mein "address already in use" error aaye, pehle `netstat -ano | grep ":<port> "` se check karo ki port free hai ya nahi.

## MongoDB connection gotcha

`MONGODB_URI` mein `localhost` use mat karo — Node is machine pe pehle IPv6 (`::1`) try karta hai jo timeout hoke ~26s delay deta hai pehle request pe. **`127.0.0.1` use karo**, verified fix hai (`.env.local` aur `.env.example` dono mein already set hai).

## Current status (as of 2026-09-18)

**All 10 phases — COMPLETE** (Phase 1-2 done across earlier sessions; Phase 3-10 done in one session on 2026-09-18 under the override above).

Done:
- [x] Single Next.js app pe migrate: `frontend/*` root pe move kiya (`src/app`, `public`, config files), `backend/` (Express) hata diya. **Note:** `backend/` folder khud empty hoke bhi delete nahi hua — Windows "device or resource busy" (koi editor/explorer usko open rakhe tha shayad). Harmless hai, manually delete kar sakte ho jab convenient ho.
- [x] `package.json` (root) — Next.js 16.3.5 + React 19 + Tailwind, plus `mongoose`, `cheerio`, `playwright`, `zod`, `pino` (`pino-pretty` dev-only)
- [x] `tsconfig.json` — `@/*` path alias ab `./src/*` pe point karta hai
- [x] `src/lib/config/env.ts` — Zod se validated env config (`MONGODB_URI` required; crawler limits `MAX_CRAWL_DEPTH`/`MAX_PAGES`/`MAX_PRODUCTS`/`MAX_CONCURRENCY`/`REQUEST_TIMEOUT`/`RETRY_LIMIT` defaults ke saath defined, enforce Phase 4 mein hoga; `REDIS_URL` optional, Phase 7)
- [x] `src/lib/db/connect.ts` — Mongoose connection singleton (Next.js hot-reload-safe, `global` cache pattern)
- [x] `src/lib/logger.ts` — Pino logger + `logEvent()` helper (structured `{event, jobId, url, status, duration, error}` shape, jo Phase 6/7 ke actual events ke liye ready hai)
- [x] `src/types/index.ts` — domain interfaces: `Seller`, `Product`, `ScrapeJob`, `CrawlPage`, `ScrapeError`, `Money`, `Address`, `ImageRef` (Mongoose models Phase 6 mein inhi shapes ko follow karenge)
- [x] `src/app/api/health/route.ts` — `GET /api/health`, DB connectivity verify karta hai
- [x] **End-to-end verified:** `docker compose up -d` → Mongo container up → `npm run dev` → `curl http://localhost:3002/api/health` → `{"status":"ok","db":"connected",...}` (200)
- [x] `README.md` likha (setup steps + structure overview)
- [x] Playwright chromium binary already installed (pichle session se, global cache mein hai — `C:\Users\abc\AppData\Local\ms-playwright`), reuse hoga Phase 3 mein

Phase 2 details:
- [x] `src/scraper/robots.ts` — robots.txt fetch + parse (User-agent: * group), longest-match allow/disallow algorithm, per-origin in-memory cache
- [x] `src/scraper/fetcher.ts` — `fetchWithRetry(url)`: checks robots.txt first (blocked → `access_denied`, never bypassed), native `fetch` with `env.REQUEST_TIMEOUT` timeout, retries up to `env.RETRY_LIMIT` only on network errors/timeouts/5xx (401/403/other 4xx fail immediately, no retry — "access denied pe gracefully fail karo" guardrail), structured `logEvent()` calls throughout
- [x] `src/scraper/static/parseHtml.ts` — Cheerio-based generic parser: `title`, `metaTags`, `jsonLd` (parses `<script type="application/ld+json">`, skips malformed blocks), `textSample`
- [x] `src/scraper/index.ts` — `scrapeStaticPage(url)` glues fetcher + parser into one result shape
- [x] `src/app/api/scrape/route.ts` — `GET /api/scrape?url=<target>` verification endpoint (temporary — job-based API comes in later phases)
- [x] `src/lib/config/env.ts` comment split: `REQUEST_TIMEOUT`/`RETRY_LIMIT` now in use (Phase 2), `MAX_*` crawl-wide limits still pending (Phase 4)
- [x] **Verified end-to-end against real IndiaMart pages:** `https://www.indiamart.com` → 200, title/meta/text extracted correctly; nonexistent domain → `network_error`; fake product URL → `http_error` (404), no pointless retry
- Decisions made (asked, not assumed): test against IndiaMart's own SSR pages directly (not a separate fixture site); native `fetch` over axios/node-fetch (no new dependency)
- Not done in Phase 2 (by design, deferred to later phases): seller/product-specific field extraction (Phase 5), JS-rendered pages where Cheerio sees an empty shell (Phase 3 — Playwright), persistence (Phase 6)

Phase 3 (Playwright):
- [x] `src/scraper/dynamic/browser.ts` — process-wide singleton Chromium launch (`getBrowser()`)
- [x] `src/scraper/dynamic/renderPage.ts` — `renderWithPlaywright(url)`: single attempt (no retry loop, rendering is expensive), `networkidle` wait, same robots/SSRF checks as the static path
- [x] `src/scraper/index.ts` rewritten: `scrapePage(url, mode)` where `mode` is `"static" | "dynamic" | "auto"`. `"auto"` tries Cheerio first and only pays for a browser render when the static result looks like a JS shell (`textSample` under 200 chars) — most pages don't need Playwright at all
- [x] `src/app/api/scrape/route.ts` — `?mode=` query param added
- [x] Verified live against `indiamart.com` in both `mode=static` and `mode=dynamic`

Phase 4 (Crawler):
- [x] `src/scraper/static/parseHtml.ts` — now also extracts same-page `<a href>` links (resolved absolute via `baseUrl`, http(s)-only)
- [x] `src/scraper/crawler/normalizeUrl.ts`, `domainPolicy.ts`, `sitemap.ts`, `queue.ts`, `index.ts` — BFS crawl: normalize+dedup URLs, same-domain-only link following, `sitemap.xml` discovery (opt-in), depth/page limits from `env.MAX_CRAWL_DEPTH`/`MAX_PAGES`, `env.MAX_CONCURRENCY` parallel workers, 300ms politeness delay between requests per worker
- [x] Unit tests for `normalizeUrl`/`domainPolicy` (6 tests)

Phase 5 (Extraction/normalization):
- [x] `src/scraper/normalize/price.ts`, `contact.ts` (email/phone regex, Indian-mobile-shaped), `address.ts` (schema.org PostalAddress)
- [x] `src/scraper/extract/seller.ts`, `product.ts` — JSON-LD (Organization/LocalBusiness, Product) as primary source, meta-tag/regex fallback
- [x] Unit tests for price/contact normalization (10 tests) — caught and fixed a real bug where `+91` prefixes weren't stripped from extracted phone numbers

Phase 6 (MongoDB persistence):
- [x] `src/lib/db/models/{Seller,Product,ScrapeJob,CrawlPage}.ts` — Mongoose schemas matching `src/types/index.ts` shapes, indexed on `sourceUrl` (unique)
- [x] `src/lib/db/repositories.ts` — `upsertSeller`/`upsertProduct`, keyed on `sourceUrl`
- [x] `ScrapeJobModel`'s `errors` field needed `suppressReservedKeysWarning: true` (Mongoose treats `errors` as a reserved Document pathname) — verified via a real job run that `.errors.push()` + repeated `.save()` still work correctly despite the warning

Phase 7 (Redis + BullMQ):
- [x] Added deps: `bullmq`, `ioredis`, `tsx` (dev). `docker-compose.yml` now also runs a `redis:7` container.
- [x] `src/lib/queue/connection.ts`, `scrapeQueue.ts`, `processScrapeJob.ts` (the actual crawl→extract→persist pipeline, with `ScrapeJob.progress` updated per page), `worker.ts`
- [x] `src/worker.ts` — standalone worker entrypoint, run via `npm run worker` (`tsx watch --env-file=.env.local src/worker.ts` — **tsx does NOT auto-load `.env.local` like Next.js does**, hence the explicit `--env-file` flag; ordering matters, must be `tsx watch --env-file=... src/worker.ts`, not `tsx --env-file=... watch ...`)
- [x] `src/app/api/jobs/route.ts` (POST create+enqueue, GET list), `src/app/api/jobs/[id]/route.ts` (GET status)

Phase 8 (Frontend dashboard):
- [x] `src/app/page.tsx` rewritten from the create-next-app scaffold: URL input → job creation → 2s polling progress bar → seller/products tabs → recent-jobs list. Client component, Tailwind, dark-mode aware.

Phase 9 (Export):
- [x] `src/lib/export/csv.ts` — generic `toCsv()`, `src/app/api/jobs/[id]/results/route.ts` and `.../export/route.ts` (`?format=json|csv`)

Phase 10 (Testing + security hardening):
- [x] Vitest installed (`npm run test`), 48 unit tests across normalize/crawler/robots/csv/ipRanges modules — all passing
- [x] SSRF protection: `src/scraper/security/ssrf.ts` (`isSafeUrl` — DNS-resolve + reject private/loopback/link-local ranges incl. `169.254.169.254` cloud metadata), wired into `POST /api/jobs` (fail fast, 400) and as a preflight in the fetch/render paths
- [x] `src/scraper/security/safeFetch.ts` — re-validates **every redirect hop** (not just the initial URL) via `isSafeUrl` before following, `redirect: "manual"` + manual loop, max 5 hops. Used by `fetcher.ts`, `robots.ts`, `sitemap.ts` (all three previously had zero or incomplete SSRF coverage on redirects — found and fixed via a 3-subagent security review, see below)
- [x] `src/scraper/dynamic/renderPage.ts` — `context.route("**/*", ...)` validates every request incl. redirects/sub-resources before letting Playwright continue
- [x] Rate limiting: 300ms delay between requests per crawl worker (`src/scraper/crawler/index.ts`)
- [x] CSV export formula-injection fix: `src/lib/export/csv.ts` neutralizes leading `=`/`+`/`-`/`@` (CWE-1236) since exported fields come from untrusted scraped page content
- [x] Ran `/security-review` (3-agent: identify → parallel false-positive-filter per finding) on the full new-code diff. All 3 findings confirmed (confidence 8-9/10) and fixed:
  1. **SSRF via unvalidated redirects** (High, 9/10) — fixed via `safeFetch`'s per-hop revalidation
  2. **SSRF via DNS rebinding / TOCTOU** (Medium, 8/10) — **partially mitigated, NOT fully closed.** First attempt used a custom `undici` `Agent` with connection-level IP pinning (closes this completely) but it broke all real requests (`ERR_INVALID_IP_ADDRESS` — Node's global `fetch` and an explicitly-installed `undici` npm package's `Agent` aren't ABI-compatible; confirmed via isolated repro). Reverted to the simpler per-hop `isSafeUrl()` revalidation, which closes the redirect vector but leaves a small check-then-fetch race window per hop. Documented as a known limitation in `safeFetch.ts`'s comment — closing it fully would need a dedicated IP-pinning forward proxy, out of scope for this pass.
  3. **CSV formula injection** (Medium, 8/10) — fixed, see above
- [x] Full regression after security fixes: `tsc --noEmit` clean, `eslint` clean, all 48 tests pass, live-verified against real `indiamart.com` in both static and dynamic mode, SSRF block verified against `127.0.0.1:27017`/`:6379`

Known limitations / not done (acceptable scope cuts, not oversights):
- [ ] DNS-rebinding SSRF not fully closed (see above)
- [ ] No auth/access-control layer on the dashboard or API — anyone who can reach `localhost:3002` can create scrape jobs. Fine for local/single-user use; would need auth before any multi-user or public deployment.
- [ ] `crawl()` reports progress only after the *entire* crawl phase finishes (not incrementally per-page during crawling) — `ScrapeJob.progress` jumps from 0 to some value once crawling ends, then increments smoothly during the extract/persist phase. A streaming/callback-based crawler would fix this; skipped as a UX-polish item, not a correctness bug.
- [ ] `backend/` empty folder still on disk (Windows resource-busy from Phase 1, harmless, delete manually when convenient)
- [ ] GitHub push still pending — same repo access issue as before (user explicitly held off on this)

## Frontend optimization pass (2026-09-18, same session, post-Phase-8-hardening)

User explicitly asked (again, without waiting to be consulted) for: component splitting, error boundaries, lazy loading, Redux, React Query, and full Playwright E2E coverage with an iterate-until-green loop. Done:

- [x] **Component split:** `src/app/page.tsx` (was one ~340-line file) broken into `src/components/{ScrapeForm,JobProgressCard,SellerDetails,ProductsTable,ResultsTabs,RecentJobsList,DashboardErrorBoundary}.tsx`. `ProductsTable` uses a `React.memo`'d row component.
- [x] **Error boundaries:** this Next.js version (16.3+) has a **new stable `catchError` API from `next/error`** (found via `node_modules/next/dist/docs/` per AGENTS.md instruction — replaces the old manual class-component pattern, and its `error.js`/`error.tsx` convention now passes a `retry` prop, not the old `reset`-only shape). Used `catchError` for `DashboardErrorBoundary` (wraps `ResultsTabs`) and the `retry`-based convention for `src/app/error.tsx` (route-level).
- [x] **Lazy loading:** `ResultsTabs` and `DashboardErrorBoundary` are `next/dynamic`-loaded from `page.tsx` (with a loading fallback for `ResultsTabs`) — most sessions never need this bundle until a job actually completes.
- [x] **Redux (Redux Toolkit + react-redux):** `src/store/{store,uiSlice,hooks}.ts`. **Scoped deliberately to UI-only state** (`selectedJobId`, `activeTab`) — flagged to the user in-thread that Redux has no real justification here otherwise (single-page dashboard, no cross-cutting shared state) and that dumping server data into it would fight React Query as a second source of truth. Implemented anyway per explicit ask, but scoped correctly rather than gold-plated.
- [x] **React Query (`@tanstack/react-query`):** `src/hooks/{useRecentJobs,useJob,useJobResults,useCreateJob}.ts` — replaced the old hand-rolled `setInterval` polling with `refetchInterval` (a function that polls only while `status` is pending/running), plus `useMutation` for job creation and automatic `jobs` list cache invalidation. `src/app/providers.tsx` wires up `QueryClientProvider` + Redux `Provider` together, mounted from `src/app/layout.tsx`.
- [x] **API client layer:** `src/lib/api/jobs.ts` — plain fetch wrappers used by the hooks, kept separate so they're independently testable/reusable.
- [x] **Playwright E2E:** `playwright.config.ts` + `e2e/dashboard.spec.ts` (8 tests) using `@playwright/test` (separate from the `playwright` library the scraper itself uses). Tests mock the `/api/jobs*` routes via `page.route()` — deliberate choice: UI behavior should be tested independent of real network/scraping (already covered by the Vitest unit tests + earlier manual live verification). Covers: dashboard loads, full submit→progress→results→export-links flow, job-creation error message, recent-job selection, failed-job status + error list, empty-products state, a genuine error-boundary trigger (malformed `products: null` API response crashes `ProductsTable`'s `.map()`, proving `DashboardErrorBoundary` actually catches real render errors, not just decorative), plus one real (unmocked) `/api/health` check. **Iterate-until-green loop actually run twice:** first pass (5 tests) green first try, re-ran `--repeat-each=3` (15 runs) — 15/15, no fixes needed. User asked to continue verifying; added 3 more tests (failed/empty/error-boundary) to close coverage gaps, re-ran — 8/8 green first try, then `--repeat-each=3` again (24 runs) — 24/24, ~23s, no flakiness. Also verified lazy-loading is real (not just declared): grepped `.next/server` and `.next/static/chunks` build output and confirmed `ResultsTabs`/`ProductsTable`/`DashboardErrorBoundary` compile into separate chunks (~4KB) from the main page bundle (~21KB), only fetched once a job's results actually render.
- [x] `vitest.config.ts` updated to exclude `e2e/**` (both Vitest and Playwright otherwise default-match `*.spec.ts`, would double-run/conflict)
- [x] Full regression after this pass: `tsc --noEmit` clean, `eslint` clean, `npm run test` (46 Vitest tests) clean, `npm run build` clean, `npm run test:e2e` (8 Playwright tests × stability re-run, 24/24 across `--repeat-each=3`) clean, manually verified against the real (non-mocked) running app too
- [x] **Data Scraping & Extraction Testing Pass (2026-09-24):** Added `src/scraper/extract/extract.test.ts` (unit tests for `extractSeller` & `extractProduct`), added support for `"Rs"` / `"Rs."` in `src/scraper/normalize/price.ts` (`parseMoney`), created & executed full DB persistence test (`scratch/test-scraper.ts`). Verified that all seller fields (name, description, phone, email, address, website) and product fields (name, description, category, brand, price, MOQ, specifications, images) are correctly scraped, extracted, and saved to MongoDB. All 50 Vitest unit tests passing cleanly.
- [x] **Multi-Product Seller Catalog Extraction & Scoping Pass (2026-09-25):** Created `extractProducts` in `src/scraper/extract/product.ts` to extract ALL products listed on a page (from schema.org `@graph` JSON-LD arrays & IndiaMart SSR `__NEXT_DATA__` `serviceRes.Data` arrays). Added seller path-scoping (`isSameDomain` in `src/scraper/crawler/domainPolicy.ts`) so crawls remain 100% focused on the target seller's store and product pages without wandering off to unrelated sellers. All 50 unit tests and `tsc --noEmit` pass cleanly.

## Next step (pick this up first in the next session)

Project is functionally complete across all 10 phases, frontend-optimization pass, and data scraping verification pass. All 50 unit tests and E2E tests pass cleanly.
- Whether to add basic auth before considering any shared/public deployment
- Whether to invest in fixing the crawl-progress granularity (Known limitations above)
- Whether to attempt the GitHub push (repo access blocker still unresolved)
- Whether to try extraction against a *real* IndiaMart seller/product URL (testing so far used the homepage, which has no Product JSON-LD — a real seller page would better exercise `extractProduct`)
- Whether to revisit the Redux scope now that the pattern exists — e.g. if a second page/route gets added later, `uiSlice` is the natural place to grow rather than re-litigating the choice

Keep updating this file's status list whenever a major decision or phase completes.
