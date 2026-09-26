import type { ImageRef, Product, ScrapeSource } from "@/types";
import { parseMoney } from "../normalize/price";
import type { ParsedPage } from "../static/parseHtml";

interface JsonLdOffer {
  price?: string | number;
}

interface JsonLdProduct {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  brand?: { name?: string } | string;
  category?: string;
  offers?: JsonLdOffer | JsonLdOffer[];
  image?: string | string[];
  url?: string;
}

/** Collects ALL Products inside JSON-LD blocks (including array graphs). */
function findAllProducts(jsonLd: unknown[]): JsonLdProduct[] {
  const results: JsonLdProduct[] = [];

  function walk(entry: unknown) {
    if (!entry || typeof entry !== "object") return;
    const obj = entry as JsonLdProduct & { "@graph"?: unknown[] };
    const types = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]];
    if (types.includes("Product")) {
      results.push(obj);
    }
    if (Array.isArray(obj["@graph"])) {
      for (const item of obj["@graph"]) walk(item);
    }
  }

  for (const item of jsonLd) walk(item);
  return results;
}

interface IndiaMartSpecRow {
  FK_IM_SPEC_MASTER_DESC?: string;
  SUPPLIER_RESPONSE_DETAIL?: string;
}

interface IndiaMartProductItemData {
  PC_ITEM_NAME?: string;
  TITLE?: string;
  ITEM_NAME?: string;
  PC_ITEM_DESC_SMALL?: string;
  DESCRIPTION?: string;
  PC_ITEM_FOB_PRICE?: string;
  PRICE?: string;
  PARENT_MCAT?: { GLCAT_MCAT_NAME?: string };
  BRD_MCAT_NAME?: string;
  PC_ITEM_MIN_ORDER_QUANTITY?: string;
  PC_ITEM_MOQ_UNIT_TYPE?: string;
  ISQ?: IndiaMartSpecRow[];
  IMAGE_500?: string;
  IMAGE_150?: string;
  PC_ITEM_IMG_PATH?: string;
  PRD_URL?: string;
  PC_ITEM_URL?: string;
}

/** Extracts all product items from IndiaMart's SSR `__NEXT_DATA__` serviceRes.Data payload. */
function findAllIndiaMartProductData(nextData: unknown): IndiaMartProductItemData[] {
  if (!nextData || typeof nextData !== "object") return [];
  const props = (nextData as { props?: unknown }).props;
  if (!props || typeof props !== "object") return [];
  const pageProps = (props as { pageProps?: unknown }).pageProps;
  if (!pageProps || typeof pageProps !== "object") return [];
  const serviceRes = (pageProps as { serviceRes?: unknown }).serviceRes;
  if (!serviceRes || typeof serviceRes !== "object") return [];
  const data = (serviceRes as { Data?: unknown }).Data;
  if (!Array.isArray(data)) return [];
  return data.filter((item) => item && typeof item === "object") as IndiaMartProductItemData[];
}

function specifications(rows: IndiaMartSpecRow[] | undefined): Record<string, string> | undefined {
  if (!rows?.length) return undefined;
  const specs: Record<string, string> = {};
  for (const row of rows) {
    if (row.FK_IM_SPEC_MASTER_DESC && row.SUPPLIER_RESPONSE_DETAIL) {
      specs[row.FK_IM_SPEC_MASTER_DESC] = row.SUPPLIER_RESPONSE_DETAIL;
    }
  }
  return Object.keys(specs).length ? specs : undefined;
}

function minimumOrderQuantity(data: IndiaMartProductItemData): string | undefined {
  const qty = data.PC_ITEM_MIN_ORDER_QUANTITY?.trim();
  if (!qty) return undefined;
  const unit = data.PC_ITEM_MOQ_UNIT_TYPE?.trim();
  return unit ? `${qty} ${unit}` : qty;
}

function extractProductName(item: JsonLdProduct | undefined, metaTitle: string | undefined, pageTitle: string | null, url: string): string {
  if (item?.name) return item.name;
  try {
    const parsedUrl = new URL(url);
    const pnParam = parsedUrl.searchParams.get("pn");
    if (pnParam) return decodeURIComponent(pnParam);
  } catch {
    // Ignore URL parse error
  }
  return metaTitle ?? pageTitle ?? "Unknown product";
}

/** Extracts a single primary product from JSON-LD / metadata / SSR payload. */
export function extractProduct(parsed: ParsedPage, url: string, source: ScrapeSource): Partial<Product> {
  const items = findAllProducts(parsed.jsonLd);
  const item = items[0];
  const imItems = findAllIndiaMartProductData(parsed.nextData);
  const imData = imItems[0];
  const specs = specifications(imData?.ISQ);

  const name = extractProductName(item, parsed.metaTags["og:title"], parsed.title, url);
  const description = item?.description ?? parsed.metaTags["description"];
  const brand = (typeof item?.brand === "string" ? item.brand : item?.brand?.name) ?? specs?.["Brand"];
  const category = item?.category ?? imData?.PARENT_MCAT?.GLCAT_MCAT_NAME ?? imData?.BRD_MCAT_NAME;

  const offer = Array.isArray(item?.offers) ? item.offers[0] : item?.offers;
  const price = offer?.price !== undefined ? parseMoney(String(offer.price)) : (imData?.PRICE || imData?.PC_ITEM_FOB_PRICE ? parseMoney(imData.PRICE || imData.PC_ITEM_FOB_PRICE!) : undefined);

  const rawImages = item?.image ? (Array.isArray(item.image) ? item.image : [item.image]) : [];
  if (imData?.IMAGE_500 || imData?.IMAGE_150 || imData?.PC_ITEM_IMG_PATH) {
    const img = imData.IMAGE_500 || imData.IMAGE_150 || imData.PC_ITEM_IMG_PATH;
    if (img && !rawImages.includes(img)) rawImages.push(img);
  }
  const images: ImageRef[] = rawImages.map((imgUrl) => ({ url: imgUrl, source: "json-ld" }));

  return {
    source,
    sourceUrl: url,
    name,
    description,
    category,
    brand,
    price,
    minimumOrderQuantity: imData ? minimumOrderQuantity(imData) : undefined,
    specifications: specs,
    images,
    scrapedAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Extracts ALL products found on a page (from JSON-LD array graph, IndiaMart SSR Data payload, etc.). */
export function extractProducts(parsed: ParsedPage, pageUrl: string, source: ScrapeSource): Partial<Product>[] {
  const productsMap = new Map<string, Partial<Product>>();

  // 1. Process JSON-LD Products
  const jsonLdItems = findAllProducts(parsed.jsonLd);
  for (const item of jsonLdItems) {
    if (!item.name) continue;
    const itemUrl = item.url ? new URL(item.url, pageUrl).toString() : pageUrl;
    const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
    const price = offer?.price !== undefined ? parseMoney(String(offer.price)) : undefined;
    const rawImages = item.image ? (Array.isArray(item.image) ? item.image : [item.image]) : [];
    const images: ImageRef[] = rawImages.map((imgUrl) => ({ url: imgUrl, source: "json-ld" }));

    productsMap.set(item.name.trim().toLowerCase(), {
      source,
      sourceUrl: itemUrl,
      name: item.name.trim(),
      description: item.description,
      category: item.category,
      brand: typeof item.brand === "string" ? item.brand : item.brand?.name,
      price,
      images,
      scrapedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 2. Process IndiaMart SSR Data Products
  const imItems = findAllIndiaMartProductData(parsed.nextData);
  for (const imData of imItems) {
    const name = imData.PC_ITEM_NAME || imData.TITLE || imData.ITEM_NAME;
    if (!name) continue;
    const key = name.trim().toLowerCase();

    const existing = productsMap.get(key) || {
      source,
      sourceUrl: imData.PRD_URL || imData.PC_ITEM_URL ? new URL(imData.PRD_URL || imData.PC_ITEM_URL!, pageUrl).toString() : pageUrl,
      name: name.trim(),
      scrapedAt: new Date(),
      updatedAt: new Date(),
    };

    const specs = specifications(imData.ISQ);
    const priceRaw = imData.PRICE || imData.PC_ITEM_FOB_PRICE;
    const price = priceRaw ? parseMoney(priceRaw) : existing.price;
    const category = imData.PARENT_MCAT?.GLCAT_MCAT_NAME || imData.BRD_MCAT_NAME || existing.category;
    const moq = minimumOrderQuantity(imData) || existing.minimumOrderQuantity;

    const imgUrl = imData.IMAGE_500 || imData.IMAGE_150 || imData.PC_ITEM_IMG_PATH;
    const images: ImageRef[] = existing.images ? [...existing.images] : [];
    if (imgUrl && !images.some((i) => i.url === imgUrl)) {
      images.push({ url: imgUrl, source: "json-ld" });
    }

    productsMap.set(key, {
      ...existing,
      category,
      price,
      minimumOrderQuantity: moq,
      specifications: specs || existing.specifications,
      images,
    });
  }

  // 3. Fallback to extractProduct if no array list found
  if (productsMap.size === 0) {
    const single = extractProduct(parsed, pageUrl, source);
    if (single.name && single.name !== "Unknown product") {
      productsMap.set(single.name.trim().toLowerCase(), single);
    }
  }

  return Array.from(productsMap.values());
}
