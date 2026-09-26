"use client";

import { useState } from "react";
import { Pagination } from "@/components/Pagination";
import { ProductGridCard } from "@/components/ProductGridCard";
import { InboxIcon, SearchIcon } from "@/components/icons";
import { useProductCategories, useProducts } from "@/hooks/useProducts";

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "price:asc", label: "Price: Low to High" },
  { value: "price:desc", label: "Price: High to Low" },
  { value: "name:asc", label: "Name A-Z" },
  { value: "name:desc", label: "Name Z-A" },
];

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("createdAt:desc");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [mobileCatOpen, setMobileCatOpen] = useState(false);

  const { data: categories = [] } = useProductCategories();
  const { data, isLoading } = useProducts({ page, category: category || undefined, search: search || undefined, sort });

  const products = data?.data ?? [];
  const totalProducts = data?.meta.total ?? 0;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function selectCategory(name: string) {
    setCategory((prev) => (prev === name ? "" : name));
    setPage(1);
    setMobileCatOpen(false);
  }

  const categoryNav = (
    <nav className="flex flex-col gap-0.5 p-2">
      <button
        onClick={() => selectCategory("")}
        className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${
          !category ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"
        }`}
      >
        All Categories
        <span className="text-xs text-current opacity-60">{totalProducts}</span>
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
  );

  return (
    <div className="flex flex-1">
      {mobileCatOpen && (
        <div className="fixed inset-0 z-30 sm:hidden">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setMobileCatOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[80vw] flex-col bg-white shadow-xl dark:bg-slate-950">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
              Categories
            </div>
            {categoryNav}
          </aside>
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 overflow-y-auto border-r border-slate-200 sm:block dark:border-slate-800">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
          Categories
        </div>
        {categoryNav}
      </aside>

      <main className="flex-1 px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                {category || "All Products"}
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {isLoading ? "Loading…" : `${totalProducts.toLocaleString()} products`}
              </p>
              <button
                onClick={() => setMobileCatOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 sm:hidden dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {category || "All Categories"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <form onSubmit={handleSearch} className="flex gap-1.5">
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search products…"
                    className="h-8 w-48 rounded-lg border border-slate-300 bg-white pl-7 pr-2 text-xs text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                  />
                </div>
                <button type="submit" className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                  Search
                </button>
              </form>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
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
                {search ? `No products matching "${search}"` : "No products yet — submit a URL to start scraping"}
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
