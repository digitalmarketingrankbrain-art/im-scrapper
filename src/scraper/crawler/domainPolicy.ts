/** Keeps the crawl inside the starting domain and specific seller scope (path/subdomain) — no wandering off to third-party or unrelated sellers. */
export function isSameDomain(url: string, allowedHost: string, startUrl?: string): boolean {
  try {
    const targetParsed = new URL(url);
    const host = targetParsed.hostname.toLowerCase();
    const allowed = allowedHost.toLowerCase();

    if (!(host === allowed || host.endsWith(`.${allowed}`))) return false;

    // For IndiaMart (www.indiamart.com), scope to the starting seller's path if available
    if (host.includes("indiamart.com") && startUrl) {
      const startParsed = new URL(startUrl);
      const startPathSegments = startParsed.pathname.split("/").filter(Boolean);
      if (startPathSegments.length > 0) {
        const sellerSlug = startPathSegments[0].toLowerCase();
        // Skip common global IndiaMart utility paths that aren't seller pages
        if (["terms-of-use.html", "privacy-policy.html", "aboutus", "dir"].includes(sellerSlug)) {
          return true;
        }
        const targetPath = targetParsed.pathname.toLowerCase();
        if (targetPath.startsWith(`/${sellerSlug}`) || targetPath.startsWith("/proddetail")) {
          return true;
        }
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}
