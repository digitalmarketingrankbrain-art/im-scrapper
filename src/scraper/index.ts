import type { CrawlErrorType } from "@/types";
import { renderWithPlaywright } from "./dynamic/renderPage";
import { fetchWithRetry, type FetchResult } from "./fetcher";
import { parseHtml, type ParsedPage } from "./static/parseHtml";

export type ScrapeMode = "static" | "dynamic" | "auto";

export interface ScrapeStaticResult {
  ok: boolean;
  url: string;
  httpStatus?: number;
  fetchedAt: string;
  renderedWith: "static" | "dynamic";
  data?: ParsedPage;
  error?: { type: CrawlErrorType; message: string };
}

/** Below this many characters of body text, static HTML is probably a JS shell, not real content. */
const THIN_CONTENT_THRESHOLD = 200;

function isThin(data: ParsedPage): boolean {
  return data.textSample.trim().length < THIN_CONTENT_THRESHOLD;
}

function toResult(
  url: string,
  fetchedAt: string,
  renderedWith: "static" | "dynamic",
  result: FetchResult,
): ScrapeStaticResult {
  if (!result.ok) {
    return {
      ok: false,
      url,
      httpStatus: result.httpStatus,
      fetchedAt,
      renderedWith,
      error: { type: result.errorType, message: result.message },
    };
  }
  return {
    ok: true,
    url,
    httpStatus: result.httpStatus,
    fetchedAt,
    renderedWith,
    data: parseHtml(result.html, url),
  };
}

/**
 * "auto" tries Cheerio first (cheap) and only pays for a Playwright render when the static
 * page loaded fine but looks like an empty JS shell — most pages don't need a browser at all.
 * A failed static fetch (429, 5xx, timeout) is NOT sent to the browser: the browser would hit the
 * same block from the same IP, and spawning Chromium on top of a rate limit is what crashed it.
 * The crawler's verify phase retries those pages later instead.
 */
export async function scrapePage(url: string, mode: ScrapeMode = "auto"): Promise<ScrapeStaticResult> {
  const fetchedAt = new Date().toISOString();

  if (mode === "dynamic") {
    return toResult(url, fetchedAt, "dynamic", await renderWithPlaywright(url));
  }

  const staticResult = toResult(url, fetchedAt, "static", await fetchWithRetry(url));

  if (mode === "static") return staticResult;

  const needsRender = staticResult.ok && !!staticResult.data && isThin(staticResult.data);
  if (!needsRender) return staticResult;

  const dynamicResult = toResult(url, fetchedAt, "dynamic", await renderWithPlaywright(url));
  if (!dynamicResult.ok && staticResult.ok) return staticResult;
  return dynamicResult;
}
