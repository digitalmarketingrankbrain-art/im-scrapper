import * as cheerio from "cheerio";
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

function isGenericPageTitle(title: string | undefined | null, url?: string): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (t.length < 3) return true;

  const genericPatterns = [
    // Section headings of a storefront page, not products
    "our company", "ratings & reviews", "ratings and reviews", "why us", "tell us what you need",
    "products & services", "products and services", "testimonial",
    "about us", "contact us", "profile", "sitemap", "enquiry", "photos",
    "feedback", "home", "our products", "privacy policy", "terms of use",
    "manufacturer from", "trader from", "supplier from", "wholesaler from",
    "exporter from", "distributor from"
  ];
  if (genericPatterns.some(p => t.includes(p))) return true;

  if (url) {
    try {
      const parsedPath = new URL(url).pathname.toLowerCase();
      if (["/", "/profile.html", "/products.html", "/enquiry.html", "/photos.html", "/sitemap.html", "/aboutus.html"].includes(parsedPath)) {
        return true;
      }
    } catch {}
  }
  return false;
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
  const candidate = metaTitle ?? pageTitle;
  if (candidate && !isGenericPageTitle(candidate, url)) return candidate;
  return "Unknown product";
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
  if (rawImages.length === 0 && (parsed.metaTags["og:image"] || parsed.metaTags["twitter:image"])) {
    rawImages.push(parsed.metaTags["og:image"] || parsed.metaTags["twitter:image"]);
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

/** Extracts products from HTML DOM card blocks (e.g. IndiaMart storefront pages with .videoclass, .bx4, etc.). */
function extractDomProducts(rawHtml: string | undefined, pageUrl: string, source: ScrapeSource): Partial<Product>[] {
  if (!rawHtml) return [];
  const $ = cheerio.load(rawHtml);
  const products: Partial<Product>[] = [];

  const pageH1 = $("h1").first().text().trim();
  const pageCategory = pageH1 && pageH1.length < 70 && !["Home", "About Us", "Our Products", "Contact Us", "Profile"].includes(pageH1) ? pageH1 : undefined;

  let cardContainers = $(".videoclass, .bx4, .prd-card, .pro-lst, .catprd, .p_box, [data-prodid]");

  if (cardContainers.length === 0) {
    const cards: (typeof cardContainers)[number][] = [];
    $("h2, h3, .prd-name, a.c3_nam").each((_, titleEl) => {
      const text = $(titleEl).text().trim();
      if (text.length > 3 && text.length < 120 && !["Home", "About Us", "Our Products", "Contact Us", "Profile"].includes(text)) {
        const parent = $(titleEl).closest("div[class*='bx'], div[class*='prd'], div[class*='lst'], div.fl, div.p7, div");
        if (parent.length && parent.find("img").length > 0) {
          cards.push(parent[0] as (typeof cardContainers)[number]);
        }
      }
    });
    cardContainers = $(Array.from(new Set(cards)));
  }

  cardContainers.each((_, cardEl) => {
    const $card = $(cardEl);

    const title = $card.find("h2, h3, h4, .prd-name, a.c3_nam, a[href*='.html']").first().text().trim();
    if (!title || isGenericPageTitle(title)) {
      return;
    }

    const linkHref = $card.find("a[href*='.html'], a.c3_nam").first().attr("href");
    const sourceUrl = linkHref ? new URL(linkHref, pageUrl).toString() : pageUrl;

    // .first(): a card can match several price nodes, and .text() on all of them glues the prices together ("₹ 31,500₹ 54,500").
    const priceText = $card.find(".p_glp, .fnt12_p, .price, .prc, span:contains('₹'), span:contains('Rs')").first().text().trim();
    const price = priceText ? parseMoney(priceText) : undefined;
    const unit = price?.unit ? price.unit.replace(/Get/i, "").trim() : undefined;

    const images: ImageRef[] = [];
    const addedUrls = new Set<string>();

    const addImg = (urlStr: string | undefined) => {
      if (!urlStr) return;
      const clean = urlStr.trim();
      if (
        clean &&
        !clean.includes("zero.gif") &&
        !clean.includes("favicon") &&
        !clean.includes("logo") &&
        !addedUrls.has(clean)
      ) {
        addedUrls.add(clean);
        images.push({ url: clean, source: "html" });
      }
    };

    $card.find("img").each((_, imgEl) => {
      const multiImg = $(imgEl).attr("data-multiimg");
      if (multiImg) {
        multiImg.split(",").forEach((img) => addImg(img));
      }
      addImg($(imgEl).attr("data-bimg"));
      addImg($(imgEl).attr("dataimg"));
      // Lazy-loaded cards keep the real URL in data-* attributes and a placeholder in src.
      for (const attr of ["data-src", "data-original", "data-lazy-src", "data-zoom-image"]) {
        addImg($(imgEl).attr(attr));
      }
      const src = $(imgEl).attr("src");
      if (src && src.includes("imimg.com")) {
        addImg(src);
      }
    });

    const specs: Record<string, string> = {};
    $card.find("table tr").each((_, trEl) => {
      const tds = $(trEl).find("td, th");
      if (tds.length >= 2) {
        const key = $(tds[0]).text().trim().replace(/:\s*$/, "");
        const val = $(tds[1]).text().trim();
        if (key && val && key.length < 60 && val.length < 300) {
          specs[key] = val;
        }
      }
    });

    const category = pageCategory || specs["Category"] || specs["Product Type"] || undefined;
    const subCategory = specs["Application"] || specs["Battery Type"] || specs["Battery Form Factor"] || undefined;
    const brand = specs["Brand"] || specs["Make"] || specs["Manufacturer"] || undefined;
    const model = specs["Model"] || specs["Model Name"] || specs["Battery Cell Model"] || specs["Part Number"] || specs["Item Code"] || undefined;
    const moq = specs["Minimum Order Quantity"] || specs["MOQ"] || (unit ? `1 ${unit}` : undefined);

    let rawDesc = $card.find(".desc, .p_dsc, .prd-desc, p.j, p.m13, div.desc, .dtl_sec").text().trim();
    rawDesc = rawDesc
      .replace(/✓\s*Thanks for Contacting Us\.?/gi, "")
      .replace(/Additional Information\s*:?/gi, "")
      .replace(/Get Latest Price/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    let description: string | undefined = rawDesc;
    if (!description || description.length < 15) {
      const parts: string[] = [`${title}.`];
      if (specs["Battery Voltage"] || specs["Voltage"]) parts.push(`Voltage: ${specs["Battery Voltage"] || specs["Voltage"]}.`);
      if (specs["Battery Capacity"] || specs["Capacity"]) parts.push(`Capacity: ${specs["Battery Capacity"] || specs["Capacity"]}.`);
      if (specs["Battery Chemistry"] || specs["Chemistry"]) parts.push(`Chemistry: ${specs["Battery Chemistry"] || specs["Chemistry"]}.`);
      if (specs["Application"]) parts.push(`Application: ${specs["Application"]}.`);
      if (specs["Warranty"]) parts.push(`Warranty: ${specs["Warranty"]}.`);
      description = parts.length > 1 ? parts.join(" ") : undefined;
    }

    products.push({
      source,
      sourceUrl,
      name: title,
      description,
      category,
      subCategory,
      brand,
      model,
      price,
      minimumOrderQuantity: moq,
      specifications: Object.keys(specs).length > 0 ? specs : undefined,
      images,
      scrapedAt: new Date(),
      updatedAt: new Date(),
    });
  });

  return products;
}

/** Extracts ALL products found on a page (from JSON-LD array graph, IndiaMart SSR Data payload, DOM cards, etc.). */
export function extractProducts(parsed: ParsedPage, pageUrl: string, source: ScrapeSource): Partial<Product>[] {
  const productsMap = new Map<string, Partial<Product>>();

  // 1. Process DOM product cards (highest quality for IndiaMART storefront category pages)
  const domProducts = extractDomProducts(parsed.rawHtml, pageUrl, source);
  for (const domProd of domProducts) {
    if (domProd.name) {
      productsMap.set(domProd.name.trim().toLowerCase(), domProd);
    }
  }

  // 2. Process JSON-LD Products
  const jsonLdItems = findAllProducts(parsed.jsonLd);
  for (const item of jsonLdItems) {
    if (!item.name) continue;
    const key = item.name.trim().toLowerCase();
    const itemUrl = item.url ? new URL(item.url, pageUrl).toString() : pageUrl;
    const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
    const price = offer?.price !== undefined ? parseMoney(String(offer.price)) : undefined;
    const rawImages = item.image ? (Array.isArray(item.image) ? item.image : [item.image]) : [];
    const jsonImages: ImageRef[] = rawImages.map((imgUrl) => ({ url: imgUrl, source: "json-ld" }));

    const existing = productsMap.get(key);
    if (existing) {
      // Merge images & missing fields into existing DOM product
      const mergedImages = [...(existing.images || [])];
      for (const img of jsonImages) {
        if (!mergedImages.some((i) => i.url === img.url)) mergedImages.push(img);
      }
      productsMap.set(key, {
        ...existing,
        price: existing.price || price,
        description: existing.description || item.description,
        category: existing.category || item.category,
        brand: existing.brand || (typeof item.brand === "string" ? item.brand : item.brand?.name),
        images: mergedImages,
      });
    } else {
      productsMap.set(key, {
        source,
        sourceUrl: itemUrl,
        name: item.name.trim(),
        description: item.description,
        category: item.category,
        brand: typeof item.brand === "string" ? item.brand : item.brand?.name,
        price,
        images: jsonImages,
        scrapedAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // 3. Process IndiaMart SSR Data Products
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

  // 4. Process storefront drop_product JS array if present
  if (parsed.rawHtml) {
    const dropMatch = parsed.rawHtml.match(/var\s+drop_product\s*=\s*(?:eval\()?(\[[^;]+\])\)?;/);
    if (dropMatch) {
      try {
        const arr = eval(dropMatch[1]);
        if (Array.isArray(arr)) {
          for (let i = 0; i < arr.length; i += 5) {
            const prodName = arr[i];
            const prodRelUrl = arr[i + 1];
            if (typeof prodName === "string" && prodName.trim()) {
              const key = prodName.trim().toLowerCase();
              if (!productsMap.has(key)) {
                const prodUrl = prodRelUrl ? new URL(prodRelUrl, pageUrl).toString() : pageUrl;
                productsMap.set(key, {
                  source,
                  sourceUrl: prodUrl,
                  name: prodName.trim(),
                  category: prodName.trim(),
                  images: parsed.metaTags["og:image"] ? [{ url: parsed.metaTags["og:image"], source: "json-ld" }] : [],
                  scrapedAt: new Date(),
                  updatedAt: new Date(),
                });
              }
            }
          }
        }
      } catch {
        // Skip malformed JS
      }
    }
  }

  // 5. Fallback to extractProduct if no array list found
  if (productsMap.size === 0) {
    const single = extractProduct(parsed, pageUrl, source);
    if (single.name && single.name !== "Unknown product") {
      productsMap.set(single.name.trim().toLowerCase(), single);
    }
  }

  return Array.from(productsMap.values());
}
