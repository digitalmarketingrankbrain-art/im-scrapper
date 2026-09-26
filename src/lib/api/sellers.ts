import { parseJsonOrThrow } from "@/lib/api/jobs";
import type { NamedCount, Paginated, SellerListItem } from "@/types/dashboard";

export interface SellersListParams {
  page: number;
  limit?: number;
  search?: string;
  letter?: string;
}

export async function fetchSellers(params: SellersListParams): Promise<Paginated<SellerListItem>> {
  const query = new URLSearchParams({ page: String(params.page), limit: String(params.limit ?? 30) });
  if (params.search) query.set("search", params.search);
  if (params.letter) query.set("letter", params.letter);
  const res = await fetch(`/api/sellers?${query.toString()}`);
  return (await parseJsonOrThrow(res)) as Paginated<SellerListItem>;
}

export async function fetchSeller(id: string): Promise<SellerListItem> {
  const res = await fetch(`/api/sellers/${id}`);
  return (await parseJsonOrThrow(res)) as SellerListItem;
}

export async function fetchSellerCategories(id: string): Promise<NamedCount[]> {
  const res = await fetch(`/api/sellers/${id}/categories`);
  return (await parseJsonOrThrow(res)) as NamedCount[];
}
