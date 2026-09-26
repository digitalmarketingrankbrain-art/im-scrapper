import { useQuery } from "@tanstack/react-query";
import { fetchSeller, fetchSellerCategories, fetchSellers, type SellersListParams } from "@/lib/api/sellers";

export function useSellers(params: SellersListParams) {
  return useQuery({
    queryKey: ["sellers", params],
    queryFn: () => fetchSellers(params),
  });
}

export function useSeller(id: string | undefined) {
  return useQuery({
    queryKey: ["seller", id],
    queryFn: () => fetchSeller(id as string),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSellerCategories(id: string | undefined) {
  return useQuery({
    queryKey: ["seller-categories", id],
    queryFn: () => fetchSellerCategories(id as string),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}
