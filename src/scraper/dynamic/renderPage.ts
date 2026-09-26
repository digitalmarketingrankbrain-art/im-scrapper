import { lookup } from "node:dns/promises";
import type { Route } from "playwright";
import { env } from "@/lib/config/env";
import { logEvent } from "@/lib/logger";
import { isAllowedByRobots } from "../robots";
import { isPrivateAddress } from "../security/ipRanges";
import { isSafeUrl } from "../security/ssrf";
import type { FetchResult } from "../fetcher";
import { getBrowser } from "./browser";

const USER_AGENT = "Mozilla/5.0 (compatible; IndiaMartScraperBot/0.1; educational-project)";

/**
 * Validates every request the page makes — including redirect hops and sub-resources,
 * not just the initial navigation — so a same-origin redirect can't smuggle the browser
 * to an internal address. (Doesn't fully close a DNS-rebind between this check and
 * Chromium's own connect; see safeFetch.ts, which pins the connection for the Cheerio path.)
 */
async function blockUnsafeRequests(route: Route): Promise<void> {
  let hostname: string;
  try {
    hostname = new URL(route.request().url()).hostname;
  } catch {
    await route.abort();
    return;
  }

  try {
    const { address, family } = await lookup(hostname);
    if (isPrivateAddress(address, family)) {
      await route.abort();
      return;
    }
  } catch {
    await route.abort();
    return;
  }

  await route.continue();
}

/** Renders a page with a real browser for JS-heavy content. Single attempt — rendering is expensive, no retry loop. */
export async function renderWithPlaywright(url: string): Promise<FetchResult> {
  if (!(await isSafeUrl(url))) {
    logEvent({ event: "RENDER_BLOCKED_SSRF", url, status: "skipped" });
    return { ok: false, url, errorType: "validation_error", message: "URL resolves to a private/internal address" };
  }

  const allowed = await isAllowedByRobots(url);
  if (!allowed) {
    logEvent({ event: "RENDER_BLOCKED_ROBOTS", url, status: "skipped" });
    return { ok: false, url, errorType: "access_denied", message: "Disallowed by robots.txt" };
  }

  const startedAt = Date.now();
  let context: Awaited<ReturnType<Awaited<ReturnType<typeof getBrowser>>["newContext"]>> | null = null;

  try {
    const browser = await getBrowser();
    context = await browser.newContext({ userAgent: USER_AGENT });
    await context.route("**/*", blockUnsafeRequests);
    const page = await context.newPage();

    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: env.REQUEST_TIMEOUT,
    });
    const duration = Date.now() - startedAt;

    if (!response) {
      logEvent({ event: "RENDER_ERROR", url, duration, error: "No response" });
      return { ok: false, url, errorType: "network_error", message: "Navigation produced no response" };
    }

    const status = response.status();

    if (status === 401 || status === 403) {
      logEvent({ event: "RENDER_ACCESS_DENIED", url, status: String(status), duration });
      return { ok: false, url, httpStatus: status, errorType: "access_denied", message: `HTTP ${status}` };
    }

    if (status >= 400) {
      logEvent({ event: "RENDER_HTTP_ERROR", url, status: String(status), duration });
      return { ok: false, url, httpStatus: status, errorType: "http_error", message: `HTTP ${status}` };
    }

    const html = await page.content();
    logEvent({ event: "RENDER_SUCCESS", url, status: String(status), duration });
    return { ok: true, url, httpStatus: status, html };
  } catch (error) {
    const duration = Date.now() - startedAt;
    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    const message = error instanceof Error ? error.message : String(error);
    logEvent({ event: "RENDER_ERROR", url, duration, error: message });
    return { ok: false, url, errorType: isTimeout ? "timeout" : "unknown_error", message };
  } finally {
    if (context) await context.close();
  }
}
