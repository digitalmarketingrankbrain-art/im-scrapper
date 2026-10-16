import type { ImageRef, Product, ScrapeSource } from "@/types";
import type { ParsedPage } from "../static/parseHtml";
import { extractBreadcrumb, mapBreadcrumb } from "./breadcrumb";
import { productKeyUrl } from "./mergeDetail";
import { extractProduct, findAllIndiaMartProductData, limitImages } from "./product";
import { type DetailSeller, extractSellerFromDetail } from "./seller";

/** A product needs at least this many specifications to be worth saving. */
export const MIN_SPECS = 3;

/** The visible spec table on an IndiaMart product page — scoped so the seller's info rows never count as specs. */
const SPEC_TABLE_SELECTOR = ".isq-container";

export interface ProductDetail {
  product: Partial<Product>;
  seller?: DetailSeller;
  specCount: number;
  breadcrumb: string[];
}

export function countSpecs(specs: Record<string, string> | undefined): number {
  return Object.values(specs ?? {}).filter((v) => typeof v === "string" && v.trim() !== "").length;
}

/** True for a page that describes one product: an IndiaMart `/proddetail/` page, or any page carrying schema.org Product data. */
export function looksLikeProductPage(parsed: ParsedPage, url: string): boolean {
  if (/\/proddetail\//i.test(url)) return true;
  return findAllIndiaMartProductData(parsed.nextData).some((d) => d.PC_ITEM_NAME || d.TITLE) || JSON.stringify(parsed.jsonLd).includes('"Product"');
}

/**
 * Photos in the page's own order — the primary image first, then the gallery — as full-size URLs, capped at 5.
 * Sources: the item's main image, the gallery in the SSR payload, the JSON-LD ImageGallery, then whatever the generic extractor found.
 */
function detailImages(parsed: ParsedPage, fallback: ImageRef[] | undefined): ImageRef[] {
  const urls: string[] = [];
  const add = (u: unknown) => {
    if (typeof u === "string" && u.trim()) urls.push(u.trim());
  };

  const payload = (parsed.nextData as { props?: { pageProps?: { serviceRes?: { Data?: unknown } } } } | undefined)?.props?.pageProps?.serviceRes?.Data;
  const d = Array.isArray(payload) ? (payload[0] as Record<string, unknown> | undefined) : undefined;
  if (d) {
    add(d.PC_ITEM_IMG_1000x1000 ?? d.PC_ITEM_IMG_ORIGINAL ?? d.PC_ITEM_IMG_SMALL);
    const gallery = Array.isArray(d.ITEM_IMG) ? d.ITEM_IMG : Array.isArray(d["0"]) ? d["0"] : [];
    for (const g of gallery as Record<string, unknown>[]) add(g.IMAGE_1000x1000 ?? g.IMAGE_ORIGINAL ?? g.IMAGE_500X500 ?? g.IMAGE_250x250);
  }
  for (const block of parsed.jsonLd) {
    const media = (block as { "@type"?: string; associatedMedia?: { contentUrl?: string }[] } | null)?.associatedMedia;
    if (Array.isArray(media)) for (const m of media) add(m.contentUrl);
  }
  const refs: ImageRef[] = urls.map((url) => ({ url, source: "json-ld" as const }));
  return limitImages(refs.length > 0 ? [...refs, ...(fallback ?? [])] : fallback);
}

/** Everything one product detail page offers, in the shape the database stores. Pure: no network, no persistence. */
export function extractProductDetail(parsed: ParsedPage, url: string, source: ScrapeSource): ProductDetail {
  const base = extractProduct(parsed, url, source, { detailRoot: SPEC_TABLE_SELECTOR });
  const breadcrumb = extractBreadcrumb(parsed);
  const { subCategory, productType } = mapBreadcrumb(breadcrumb);

  // The spec table can also be present only in the rendered DOM; extractProduct already falls back to it, scoped.
  const specifications = base.specifications && countSpecs(base.specifications) > 0 ? base.specifications : undefined;

  const product: Partial<Product> = {
    ...base,
    productKey: productKeyUrl(url),
    // Breadcrumb position 2 doubles as the browse category the dashboard filters on; positions 1 and 4 are never used.
    category: subCategory ?? base.category,
    subCategory,
    productType,
    specifications,
    images: detailImages(parsed, base.images),
  };
  return { product, seller: extractSellerFromDetail(parsed, url, source), specCount: countSpecs(specifications), breadcrumb };
}
