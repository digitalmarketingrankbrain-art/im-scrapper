/** Normalizes a URL for dedup: strips fragments, sorts query params, lower-cases host, drops default ports. */
export function normalizeUrl(rawUrl: string, base?: string): string | null {
  try {
    const parsed = new URL(rawUrl, base);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    if ((parsed.protocol === "http:" && parsed.port === "80") || (parsed.protocol === "https:" && parsed.port === "443")) {
      parsed.port = "";
    }

    const sortedParams = new URLSearchParams([...parsed.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)));
    parsed.search = sortedParams.toString();

    let normalized = parsed.toString();
    if (parsed.pathname !== "/" && normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return null;
  }
}
