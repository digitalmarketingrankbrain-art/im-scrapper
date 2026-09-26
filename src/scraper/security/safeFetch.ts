import { isSafeUrl } from "./ssrf";

export interface SafeFetchInit {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

const MAX_REDIRECTS = 5;

/**
 * fetch() that re-validates every redirect hop against the SSRF guard before following it —
 * an initial URL passing the check doesn't mean a 3xx response can't point it at an internal
 * address, so each hop is checked in turn instead of trusting `redirect: "follow"` blindly.
 *
 * This does not close a DNS-rebinding race within a single hop (the IP is checked, then a
 * separate DNS resolution happens inside fetch() moments later) — closing that fully needs
 * connection-level IP pinning, which isn't practical with the platform fetch API. It does
 * close the more practical, higher-confidence attack: a redirect to an attacker-chosen host.
 */
export async function safeFetch(url: string, init: SafeFetchInit = {}): Promise<Response> {
  let currentUrl = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isSafeUrl(currentUrl))) {
      throw new Error(`Refusing to fetch private/internal address: ${currentUrl}`);
    }

    const res = await fetch(currentUrl, {
      headers: init.headers,
      signal: init.signal,
      redirect: "manual",
    });

    const isRedirect = res.status >= 300 && res.status < 400;
    if (!isRedirect) return res;

    const location = res.headers.get("location");
    if (!location) return res;

    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error(`Too many redirects while fetching ${url}`);
}
