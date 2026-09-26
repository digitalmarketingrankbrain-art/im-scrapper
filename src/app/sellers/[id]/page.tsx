"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Pagination } from "@/components/Pagination";
import { ProductGridCard } from "@/components/ProductGridCard";
import { ChevronLeftIcon, ExternalLinkIcon, GlobeIcon, InboxIcon, MailIcon, MapPinIcon, PhoneIcon } from "@/components/icons";
import { useProducts } from "@/hooks/useProducts";
import { useSeller, useSellerCategories } from "@/hooks/useSellers";

export default function SellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);

  const { data: seller } = useSeller(id);
  const { data: categories = [] } = useSellerCategories(id);
  const { data, isLoading } = useProducts({ page, sellerId: id, category: category || undefined });

  const products = data?.data ?? [];
  const totalProducts = data?.meta.total ?? seller?.productCount ?? 0;

  function selectCategory(name: string) {
    setCategory((prev) => (prev === name ? "" : name));
    setPage(1);
  }

  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col overflow-y-auto border-r border-slate-200 sm:flex dark:border-slate-800">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Link href="/sellers" className="mb-1.5 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
            <ChevronLeftIcon width="12" height="12" /> All Sellers
          </Link>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Categories</p>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          <button
            onClick={() => selectCategory("")}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${
              !category ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => selectCategory(cat.name)}
              className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${
                category === cat.name ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"
              }`}
            >
              <span className="truncate">{cat.name}</span>
              <span className="shrink-0 text-xs text-current opacity-60">{cat.count}</span>
            </button>
          ))}
          {categories.length === 0 && <p className="px-3 py-4 text-xs text-slate-400 dark:text-slate-500">No categories yet</p>}
        </nav>
      </aside>

      <main className="flex-1 px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          {seller && (
            <section className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-lg font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                {seller.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h1 className="text-base font-semibold text-slate-900 dark:text-slate-50">{seller.name}</h1>
                  <a
                    href={seller.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex shrink-0 items-center gap-1 text-xs text-blue-700 hover:underline dark:text-blue-400"
                  >
                    View source <ExternalLinkIcon width="12" height="12" />
                  </a>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {seller.businessType && (
                    <span className="flex items-center gap-1">
                      <GlobeIcon width="12" height="12" /> {seller.businessType}
                    </span>
                  )}
                  {(seller.address?.state || seller.address?.country) && (
                    <span className="flex items-center gap-1">
                      <MapPinIcon width="12" height="12" /> {[seller.address?.state, seller.address?.country].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {seller.phone?.[0] && (
                    <span className="flex items-center gap-1">
                      <PhoneIcon width="12" height="12" /> {seller.phone[0]}
                    </span>
                  )}
                  {seller.email?.[0] && (
                    <span className="flex items-center gap-1">
                      <MailIcon width="12" height="12" /> {seller.email[0]}
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}

          <header>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{category || "All Products"}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isLoading ? "Loading…" : `${totalProducts.toLocaleString()} products`}
            </p>
          </header>

          {isLoading && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-52 animate-pulse rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40" />
              ))}
            </div>
          )}

          {!isLoading && products.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 py-20 text-center dark:border-slate-700">
              <InboxIcon width="28" height="28" className="text-slate-300 dark:text-slate-700" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {category ? "No products in this category" : "No products found for this seller"}
              </p>
            </div>
          )}

          {!isLoading && products.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductGridCard key={product._id} product={product} />
              ))}
            </div>
          )}

          {data && <Pagination page={data.meta.page} pages={data.meta.pages} total={data.meta.total} onPageChange={setPage} />}
        </div>
      </main>
    </div>
  );
}
