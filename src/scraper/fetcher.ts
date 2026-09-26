import { env } from "@/lib/config/env";
import { logEvent } from "@/lib/logger";
import type { CrawlErrorType } from "@/types";
import { isAllowedByRobots } from "./robots";
import { safeFetch } from "./security/safeFetch";
import { isSafeUrl } from "./security/ssrf";

const USER_AGENT = "Mozilla/5.0 (compatible; IndiaMartScraperBot/0.1; educational-project)";

const MAX_BACKOFF_MS = 8000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry-After is either a delay in whole seconds or an HTTP-date — only the common seconds form is handled. */
function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}

export interface FetchSuccess {
  ok: true;
  url: string;
  httpStatus: number;
  html: string;
}

export interface FetchFailure {
  ok: false;
  url: string;
  httpStatus?: number;
  errorType: CrawlErrorType;
  message: string;
}

export type FetchResult = FetchSuccess | FetchFailure;

/** Fetches a page with timeout + retry. Never bypasses robots.txt or access-denied responses. */
export async function fetchWithRetry(url: string): Promise<FetchResult> {
  if (!(await isSafeUrl(url))) {
    logEvent({ event: "FETCH_BLOCKED_SSRF", url, status: "skipped" });
    return { ok: false, url, errorType: "validation_error", message: "URL resolves to a private/internal address" };
  }

  const allowed = await isAllowedByRobots(url);
  if (!allowed) {
    logEvent({ event: "FETCH_BLOCKED_ROBOTS", url, status: "skipped" });
    return { ok: false, url, errorType: "access_denied", message: "Disallowed by robots.txt" };
  }

  let lastFailure: FetchFailure | null = null;

  for (let attempt = 0; attempt <= env.RETRY_LIMIT; attempt++) {
    const startedAt = Date.now();

    try {
      const res = await safeFetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        signal: AbortSignal.timeout(env.REQUEST_TIMEOUT),
      });
      const duration = Date.now() - startedAt;

      if (res.status === 401 || res.status === 403) {
        logEvent({ event: "FETCH_ACCESS_DENIED", url, status: String(res.status), duration });
        return { ok: false, url, httpStatus: res.status, errorType: "access_denied", message: `HTTP ${res.status}` };
      }

      if (!res.ok) {
        const isRateLimited = res.status === 429;
        const isRetryable = isRateLimited || res.status >= 500;
        lastFailure = {
          ok: false,
          url,
          httpStatus: res.status,
          errorType: "http_error",
          message: `HTTP ${res.status}`,
        };
        logEvent({ event: "FETCH_HTTP_ERROR", url, status: String(res.status), duration, error: lastFailure.message });

        if (isRetryable && attempt < env.RETRY_LIMIT) {
          // A 429's Retry-After tells us exactly how long the server wants us to wait;
          // otherwise back off exponentially so a burst of failures doesn't just hammer again immediately.
          const retryAfterMs = isRateLimited ? parseRetryAfterMs(res.headers.get("retry-after")) : null;
          const backoffMs = retryAfterMs ?? Math.min(500 * 2 ** attempt, MAX_BACKOFF_MS);
          await sleep(backoffMs);
          continue; // retry transient server errors / rate limits
        }
        return lastFailure; // 4xx other than 401/403/429 — retrying won't help
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) {
        return {
          ok: false,
          url,
          httpStatus: res.status,
          errorType: "unsupported_page",
          message: `Unsupported content-type: ${contentType || "unknown"}`,
        };
      }

      const html = await res.text();
      logEvent({ event: "FETCH_SUCCESS", url, status: String(res.status), duration });
      return { ok: true, url, httpStatus: res.status, html };
    } catch (error) {
      const duration = Date.now() - startedAt;
      const isTimeout = error instanceof Error && error.name === "TimeoutError";
      lastFailure = {
        ok: false,
        url,
        errorType: isTimeout ? "timeout" : "network_error",
        message: error instanceof Error ? error.message : String(error),
      };
      logEvent({ event: "FETCH_ERROR", url, duration, error: lastFailure.message });
    }
  }

  return lastFailure ?? { ok: false, url, errorType: "unknown_error", message: "Fetch failed with no error detail" };
}
