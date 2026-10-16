import * as cheerio from "cheerio";
import type { ParsedPage } from "../static/parseHtml";

export interface BreadcrumbMapping {
  subCategory?: string;
  productType?: string;
}

function clean(text: unknown): string {
  return typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
}

/** schema.org BreadcrumbList, possibly nested in an array or `@graph`. */
function fromJsonLd(jsonLd: unknown[]): string[] {
  const walk = (entry: unknown): string[] | undefined => {
    if (Array.isArray(entry)) {
      for (const item of entry) {
        const found = walk(item);
        if (found) return found;
      }
      return undefined;
    }
    if (!entry || typeof entry !== "object") return undefined;
    const obj = entry as { "@type"?: string | string[]; itemListElement?: unknown; "@graph"?: unknown[] };
    const types = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]];
    if (types.includes("BreadcrumbList") && Array.isArray(obj.itemListElement)) {
      const items = (obj.itemListElement as { position?: number | string; name?: unknown; item?: { name?: unknown } | string }[])
        .map((el, index) => ({
          position: Number(el.position) || index + 1,
          name: clean(el.name ?? (typeof el.item === "object" ? el.item?.name : undefined)),
        }))
        .sort((a, b) => a.position - b.position);
      return items.map((i) => i.name);
    }
    return Array.isArray(obj["@graph"]) ? walk(obj["@graph"]) : undefined;
  };
  return walk(jsonLd) ?? [];
}

/** The visible breadcrumb bar ("IndiaMART > Category > Type > Product"), used when the page ships no BreadcrumbList. */
function fromDom(rawHtml: string | undefined): string[] {
  if (!rawHtml) return [];
  const $ = cheerio.load(rawHtml);
  const bar = $("nav[class*='readcrumb'], nav[class*='brdcmb'], [class*='readcrumb']").first();
  if (!bar.length) return [];
  const links = bar.find("a").toArray().map((a) => clean($(a).text()));
  const lastText = clean(bar.clone().children("a").remove().end().text()).replace(/^[\s>]+/, "");
  // Normally every crumb is an <a>, with the current page as plain trailing text — fall back to splitting on ">".
  const crumbs = [...links, ...(lastText && !links.includes(lastText) ? [lastText] : [])].filter(Boolean);
  if (crumbs.length > 1) return crumbs;
  return clean(bar.text()).split(">").map(clean).filter(Boolean);
}

/** Every crumb on the page, in order. Empty when the page has no breadcrumb. */
export function extractBreadcrumb(parsed: Pick<ParsedPage, "jsonLd" | "rawHtml">): string[] {
  const fromLd = fromJsonLd(parsed.jsonLd).filter(Boolean);
  return fromLd.length > 0 ? fromLd : fromDom(parsed.rawHtml);
}

/**
 * Position-based mapping: crumb 1 and crumb 4 are ignored, crumb 2 is the sub-category and crumb 3 the
 * product type. Never "the last crumb" — on a product page that is the product itself. Missing positions stay undefined.
 */
export function mapBreadcrumb(crumbs: string[]): BreadcrumbMapping {
  return {
    subCategory: crumbs[1] || undefined,
    productType: crumbs[2] || undefined,
  };
}
