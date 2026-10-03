import { lookup } from "node:dns/promises";
import { isPrivateAddress } from "./ipRanges";

export type UrlCheck = "safe" | "private" | "dns_error";

/** Resolved hostnames are re-used briefly: a crawl hits the same host hundreds of times and every fetch used to resolve it 2-3 times. */
const CACHE_TTL_MS = 5 * 60_000;
const hostCache = new Map<string, { result: UrlCheck; expires: number }>();

async function resolveOnce(hostname: string): Promise<UrlCheck> {
  const { address, family } = await lookup(hostname);
  return isPrivateAddress(address, family) ? "private" : "safe";
}

/** Classifies a hostname. A failed lookup is `dns_error`, NOT `private` — a flaky resolver must not be reported as an internal address. */
export async function checkHostname(hostname: string): Promise<UrlCheck> {
  if (hostname === "localhost") return "private";

  const cached = hostCache.get(hostname);
  if (cached && cached.expires > Date.now()) return cached.result;

  let result: UrlCheck;
  try {
    result = await resolveOnce(hostname);
  } catch {
    // One immediate retry: transient EAI_AGAIN / timeouts under load are common and clear instantly.
    try {
      result = await resolveOnce(hostname);
    } catch {
      return "dns_error"; // not cached — the next request should try again
    }
  }
  hostCache.set(hostname, { result, expires: Date.now() + CACHE_TTL_MS });
  return result;
}

export async function checkUrl(url: string): Promise<UrlCheck> {
  try {
    return await checkHostname(new URL(url).hostname);
  } catch {
    return "private"; // unparseable URL — refuse
  }
}

/**
 * Fast preflight check for a clear rejection message (e.g. at job-creation time).
 * This alone does NOT protect fetch/render calls against redirects or DNS rebinding —
 * see safeFetch.ts, which re-validates every redirect hop before following it.
 */
export async function isSafeUrl(url: string): Promise<boolean> {
  return (await checkUrl(url)) === "safe";
}
