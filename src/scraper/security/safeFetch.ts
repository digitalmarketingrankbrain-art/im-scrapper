import { fetch as undiciFetch, ProxyAgent } from "undici";
import { checkUrl } from "./ssrf";

export interface SafeFetchInit {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Route the request through this proxy (IP rotation). Omitted = direct connection. */
  proxyUrl?: string;
}

const MAX_REDIRECTS = 5;

const proxyAgents = new Map<string, ProxyAgent>();

function agentFor(proxyUrl: string): ProxyAgent {
  let agent = proxyAgents.get(proxyUrl);
  if (!agent) {
    agent = new ProxyAgent(proxyUrl);
    proxyAgents.set(proxyUrl, agent);
  }
  return agent;
}

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
    const check = await checkUrl(currentUrl);
    if (check === "private") throw new Error(`Refusing to fetch private/internal address: ${currentUrl}`);
    if (check === "dns_error") throw new Error(`DNS lookup failed for ${currentUrl}`);

    // Proxied requests go through undici's own fetch (it owns the ProxyAgent dispatcher);
    // direct ones keep using the platform fetch exactly as before.
    const res = init.proxyUrl
      ? ((await undiciFetch(currentUrl, {
          headers: init.headers,
          signal: init.signal,
          redirect: "manual",
          dispatcher: agentFor(init.proxyUrl),
        })) as unknown as Response)
      : await fetch(currentUrl, {
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
