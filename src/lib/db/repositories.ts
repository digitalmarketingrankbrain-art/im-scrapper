import type { Product, Seller } from "@/types";
import { ProductModel } from "./models/Product";
import { SellerModel } from "./models/Seller";

/** Upsert keyed on sourceUrl — the natural dedup key for anything scraped from a URL. */
export async function upsertSeller(data: Partial<Seller>) {
  if (!data.sourceUrl) throw new Error("sourceUrl is required to upsert a seller");
  return SellerModel.findOneAndUpdate(
    { sourceUrl: data.sourceUrl },
    { $set: data },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

/**
 * Saves a product once, however it was found (single URL, seller catalog or category listing).
 * Identity is `productKey` (IndiaMart's numeric product id); products without one fall back to the
 * seller + name pair. Re-scraping updates the existing record instead of adding a second.
 */
export async function upsertProduct(sellerId: string, data: Partial<Product>) {
  if (!data.name) throw new Error("name is required to upsert a product");
  const name = data.name.trim();
  const payload = { ...data, sellerId, name };

  const existing = data.productKey ? await ProductModel.findOne({ productKey: data.productKey }).select("_id").lean() : null;
  const filter = existing ? { _id: (existing as { _id: unknown })._id } : { sellerId, name };
  return ProductModel.findOneAndUpdate(filter, { $set: payload }, { upsert: true, new: true, setDefaultsOnInsert: true });
}
