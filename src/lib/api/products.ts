import { parseJsonOrThrow } from "@/lib/api/jobs";
import type { NamedCount, Paginated, ProductDetailView, ProductListItem } from "@/types/dashboard";

export interface ProductsListParams {
  page: number;
  limit?: number;
  category?: string;
  sellerId?: string;
  search?: string;
  sort?: string;
}

export async function fetchProducts(params: ProductsListParams): Promise<Paginated<ProductListItem>> {
  const query = new URLSearchParams({ page: String(params.page), limit: String(params.limit ?? 20) });
  if (params.category) query.set("category", params.category);
  if (params.sellerId) query.set("sellerId", params.sellerId);
  if (params.search) query.set("search", params.search);
  if (params.sort) query.set("sort", params.sort);
  const res = await fetch(`/api/products?${query.toString()}`);
  return (await parseJsonOrThrow(res)) as Paginated<ProductListItem>;
}

export async function fetchProduct(id: string): Promise<ProductDetailView> {
  const res = await fetch(`/api/products/${id}`);
  return (await parseJsonOrThrow(res)) as ProductDetailView;
}

export async function fetchProductCategories(): Promise<NamedCount[]> {
  const res = await fetch("/api/products/categories");
  return (await parseJsonOrThrow(res)) as NamedCount[];
}
