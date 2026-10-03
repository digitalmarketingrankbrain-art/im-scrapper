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

export async function upsertProduct(sellerId: string, data: Partial<Product>) {
  if (!data.name) throw new Error("name is required to upsert a product");
  const nameTrimmed = data.name.trim();
  return ProductModel.findOneAndUpdate(
    { sellerId, name: nameTrimmed },
    { $set: { ...data, sellerId, name: nameTrimmed } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}
