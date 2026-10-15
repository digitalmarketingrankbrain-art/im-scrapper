import type { Product } from "@/types";
import { limitImages } from "./product";

export function isProductDetailPage(pageUrl: string): boolean {
  try {
    return /\/proddetail\//i.test(new URL(pageUrl).pathname);
  } catch {
    return false;
  }
}

/**
 * Identity of a product across the pages that show it. IndiaMart's numeric product id is the stable part:
 * listing cards link to `/?pid=<id>&pn=...` or `page.html#<id>`, detail pages to `/proddetail/<slug>-<id>.html`.
 * Without an id the URL minus fragment/query is used.
 */
export function productKeyUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    const id =
      u.searchParams.get("pid") ??
      u.pathname.match(/-(\d{10,})\.html?$/)?.[1] ??
      u.hash.match(/^#(\d{10,})$/)?.[1];
    return id ? `id:${id}` : `${u.origin}${u.pathname}`;
  } catch {
    return undefined;
  }
}

/**
 * A listing card and the product's own detail page describe the same product, but the card carries IndiaMart's
 * product title while the detail page carries the richer data (specs, photos, key features). Keep the card's
 * identity and fill every gap — or add specs/photos — from the detail page, instead of saving two records.
 */
export function mergeDetailIntoCard(card: Partial<Product>, detail: Partial<Product>, sellerName?: string): Partial<Product> {
  // Some pages put the seller's own name in the category slot (the page heading); the other page may hold the real category.
  const isSellerName = (c: string | undefined) => !!c && !!sellerName && c.trim().toLowerCase() === sellerName.trim().toLowerCase();
  const category = [card.category, detail.category].find((c) => c && !isSellerName(c)) ?? card.category ?? detail.category;
  const specifications = { ...detail.specifications, ...card.specifications };
  const keyFeatures = { ...detail.keyFeatures, ...card.keyFeatures };
  const cardDescription = card.description && card.description.length >= 40 ? card.description : undefined;
  return {
    ...card,
    description: cardDescription ?? detail.description ?? card.description,
    category,
    subCategory: card.subCategory ?? detail.subCategory,
    brand: card.brand ?? detail.brand,
    model: card.model ?? detail.model,
    price: card.price ? { ...card.price, unit: card.price.unit ?? detail.price?.unit ?? null, currency: card.price.currency ?? detail.price?.currency ?? null } : detail.price,
    minimumOrderQuantity: card.minimumOrderQuantity ?? detail.minimumOrderQuantity,
    specifications: Object.keys(specifications).length > 0 ? specifications : undefined,
    keyFeatures: Object.keys(keyFeatures).length > 0 ? keyFeatures : undefined,
    images: limitImages([...(detail.images ?? []), ...(card.images ?? [])]),
  };
}
