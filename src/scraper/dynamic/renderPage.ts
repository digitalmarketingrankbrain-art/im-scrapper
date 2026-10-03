import type { Route } from "playwright";
import { env } from "@/lib/config/env";
import { logEvent } from "@/lib/logger";
import { isAllowedByRobots } from "../robots";
import { checkHostname, checkUrl } from "../security/ssrf";
import type { FetchResult } from "../fetcher";
import { nextProxy, reportProxyFailure } from "../proxy/pool";
import { getBrowser, resetBrowser } from "./browser";

const USER_AGENT = "Mozilla/5.0 (compatible; IndiaMartScraperBot/0.1; educational-project)";

/**
 * Validates every request the page makes — including redirect hops and sub-resources,
 * not just the initial navigation — so a same-origin redirect can't smuggle the browser
 * to an internal address. (Doesn't fully close a DNS-rebind between this check and
 * Chromium's own connect; see safeFetch.ts, which pins the connection for the Cheerio path.)
 */
/** Images/fonts/media add nothing to the HTML we parse but are what blows up Chromium's memory. */
const HEAVY_RESOURCE_TYPES = new Set(["image", "media", "font"]);

async function blockUnsafeRequests(route: Route): Promise<void> {
  if (HEAVY_RESOURCE_TYPES.has(route.request().resourceType())) {
    await route.abort();
    return;
  }

  let hostname: string;
  try {
    hostname = new URL(route.request().url()).hostname;
  } catch {
    await route.abort();
    return;
  }

  if ((await checkHostname(hostname)) !== "safe") {
    await route.abort();
    return;
  }

  await route.continue();
}

/** Playwright throws these when the tab or the whole browser process dies mid-render. */
function isCrash(message: string): boolean {
  return /crashed|Target closed|has been closed|Browser closed|disconnected/i.test(message);
}

/**
 * Chromium on a typical dev machine can't render several pages at once without tabs crashing,
 * so renders are queued one at a time even when the crawl itself runs several workers.
 */
let renderTail: Promise<unknown> = Promise.resolve();
function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = renderTail.then(fn, fn);
  renderTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function renderOnce(url: string): Promise<FetchResult> {
  const startedAt = Date.now();
  let context: Awaited<ReturnType<Awaited<ReturnType<typeof getBrowser>>["newContext"]>> | null = null;
  const proxy = nextProxy();

  try {
    const browser = await getBrowser();
    context = await browser.newContext({
      userAgent: USER_AGENT,
      proxy: proxy ? { server: proxy.server, username: proxy.username, password: proxy.password } : undefined,
    });
    await context.route("**/*", blockUnsafeRequests);
    const page = await context.newPage();

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: env.REQUEST_TIMEOUT,
    });
    // Give client-side hydration a short window to settle, but never fail the render over a chatty tracker.
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
    const duration = Date.now() - startedAt;

    if (!response) {
      logEvent({ event: "RENDER_ERROR", url, duration, error: "No response" });
      return { ok: false, url, errorType: "network_error", message: "Navigation produced no response" };
    }

    const status = response.status();

    if (status === 401 || status === 403) {
      logEvent({ event: "RENDER_ACCESS_DENIED", url, status: String(status), duration });
      reportProxyFailure(proxy);
      return { ok: false, url, httpStatus: status, errorType: "access_denied", message: `HTTP ${status}` };
    }

    if (status >= 400) {
      logEvent({ event: "RENDER_HTTP_ERROR", url, status: String(status), duration });
      if (status === 429) reportProxyFailure(proxy);
      return {
        ok: false,
        url,
        httpStatus: status,
        errorType: status === 429 ? "rate_limited" : "http_error",
        message: `HTTP ${status}`,
      };
    }

    const html = await page.content();
    logEvent({ event: "RENDER_SUCCESS", url, status: String(status), duration });
    return { ok: true, url, httpStatus: status, html };
  } catch (error) {
    const duration = Date.now() - startedAt;
    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    const message = error instanceof Error ? error.message : String(error);
    logEvent({ event: "RENDER_ERROR", url, duration, error: message });
    const errorType = isTimeout ? "timeout" : isCrash(message) ? "browser_crash" : "unknown_error";
    return { ok: false, url, errorType, message };
  } finally {
    if (context) await context.close().catch(() => undefined);
  }
}

/**
 * Renders a page with a real browser for JS-heavy content. One render at a time; if the browser
 * dies mid-render it is relaunched and the page retried once, since a crash says nothing about the page itself.
 */
export async function renderWithPlaywright(url: string): Promise<FetchResult> {
  const check = await checkUrl(url);
  if (check !== "safe") {
    logEvent({ event: "RENDER_BLOCKED_SSRF", url, status: "skipped" });
    return check === "private"
      ? { ok: false, url, errorType: "validation_error", message: "URL resolves to a private/internal address" }
      : { ok: false, url, errorType: "network_error", message: "DNS lookup failed (temporary)" };
  }

  const allowed = await isAllowedByRobots(url);
  if (!allowed) {
    logEvent({ event: "RENDER_BLOCKED_ROBOTS", url, status: "skipped" });
    return { ok: false, url, errorType: "access_denied", message: "Disallowed by robots.txt" };
  }

  return runExclusive(async () => {
    const first = await renderOnce(url);
    if (first.ok || first.errorType !== "browser_crash") return first;

    await resetBrowser();
    return renderOnce(url);
  });
}
