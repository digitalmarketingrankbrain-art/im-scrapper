import { safeFetch } from "../security/safeFetch";

/** Best-effort sitemap.xml discovery. No XML parser dependency — <loc> tags are simple enough for a regex. */
export async function discoverSitemapUrls(origin: string): Promise<string[]> {
  try {
    const res = await safeFetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];

    const xml = await res.text();
    return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1].trim()).filter(Boolean);
  } catch {
    return [];
  }
}
