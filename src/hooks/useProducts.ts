import { useQuery } from "@tanstack/react-query";
import { fetchProduct, fetchProductCategories, fetchProducts, type ProductsListParams } from "@/lib/api/products";

export function useProducts(params: ProductsListParams) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: () => fetchProducts(params),
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchProduct(id as string),
    enabled: Boolean(id),
  });
}

export function useProductCategories() {
  return useQuery({
    queryKey: ["product-categories"],
    queryFn: fetchProductCategories,
    staleTime: 5 * 60 * 1000,
  });
}
