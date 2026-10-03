import * as cheerio from "cheerio";

export interface ParsedPage {
  title: string | null;
  metaTags: Record<string, string>;
  jsonLd: unknown[];
  /** Next.js SSR hydration payload (`__NEXT_DATA__`), when present — e.g. IndiaMart's category/brand/MOQ live here, not in JSON-LD. */
  nextData: unknown;
  textSample: string;
  links: string[];
  rawHtml?: string;
}

/** Generic, page-agnostic HTML parsing. Seller/product-specific extraction is Phase 5. */
export function parseHtml(html: string, baseUrl?: string): ParsedPage {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || null;

  const metaTags: Record<string, string> = {};
  $("meta").each((_, el) => {
    const name = $(el).attr("name") ?? $(el).attr("property");
    const content = $(el).attr("content");
    if (name && content) metaTags[name] = content;
  });

  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    try {
      jsonLd.push(JSON.parse(raw));
    } catch {
      // Malformed JSON-LD on the page — skip it, don't fail the whole parse.
    }
  });

  let nextData: unknown;
  const nextDataRaw = $("script#__NEXT_DATA__").first().contents().text();
  if (nextDataRaw) {
    try {
      nextData = JSON.parse(nextDataRaw);
    } catch {
      // Malformed __NEXT_DATA__ — skip it, don't fail the whole parse.
    }
  }

  const textSample = $("body").text().replace(/\s+/g, " ").trim().slice(0, 500);

  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const resolved = new URL(href, baseUrl).toString();
      if (resolved.startsWith("http:") || resolved.startsWith("https:")) links.push(resolved);
    } catch {
      // Relative href with no baseUrl, or malformed — skip it.
    }
  });

  return { title, metaTags, jsonLd, nextData, textSample, links, rawHtml: html };
}
