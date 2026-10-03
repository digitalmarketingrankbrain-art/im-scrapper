import { env } from "@/lib/config/env";

export interface ProxyEntry {
  /** Full URL incl. credentials — what undici's ProxyAgent takes. */
  url: string;
  /** Credential-free `scheme://host:port` — what Playwright wants, with username/password passed separately. */
  server: string;
  username?: string;
  password?: string;
}

/** A proxy that just got a 429 / connection failure sits out this long before it is handed out again. */
const FAILURE_COOLDOWN_MS = 60_000;

function parseProxies(raw: string | undefined): ProxyEntry[] {
  if (!raw) return [];
  const entries: ProxyEntry[] = [];
  for (const part of raw.split(/[\s,]+/).filter(Boolean)) {
    try {
      const u = new URL(part);
      entries.push({
        url: part,
        server: `${u.protocol}//${u.host}`,
        username: u.username ? decodeURIComponent(u.username) : undefined,
        password: u.password ? decodeURIComponent(u.password) : undefined,
      });
    } catch {
      // Malformed entry in PROXY_URLS — skip it rather than crash every request.
    }
  }
  return entries;
}

const proxies = parseProxies(env.PROXY_URLS);
const badUntil = new Map<string, number>();
let cursor = proxies.length ? Math.floor(Math.random() * proxies.length) : 0;

export function proxyCount(): number {
  return proxies.length;
}

/**
 * Round-robin over healthy proxies; returns null when none are configured (direct connection).
 * If every proxy is cooling down, hands out the one that recovers soonest instead of going direct,
 * so the real IP never leaks just because the pool is having a bad minute.
 */
export function nextProxy(): ProxyEntry | null {
  if (proxies.length === 0) return null;
  const now = Date.now();

  for (let i = 0; i < proxies.length; i++) {
    const candidate = proxies[(cursor + i) % proxies.length];
    if ((badUntil.get(candidate.url) ?? 0) <= now) {
      cursor = (cursor + i + 1) % proxies.length;
      return candidate;
    }
  }
  return [...proxies].sort((a, b) => (badUntil.get(a.url) ?? 0) - (badUntil.get(b.url) ?? 0))[0];
}

export function reportProxyFailure(proxy: ProxyEntry | null): void {
  if (proxy) badUntil.set(proxy.url, Date.now() + FAILURE_COOLDOWN_MS);
}

/** True when at least one proxy other than the failed one is healthy — i.e. rotating can actually help. */
export function hasHealthyAlternative(current: ProxyEntry | null): boolean {
  const now = Date.now();
  return proxies.some((p) => p.url !== current?.url && (badUntil.get(p.url) ?? 0) <= now);
}
