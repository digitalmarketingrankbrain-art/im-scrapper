"use client";

import { memo, useState } from "react";
import { InboxIcon, ExternalLinkIcon, LayersIcon, TagIcon, CheckCircleIcon } from "@/components/icons";
import type { ProductView } from "@/types/dashboard";

const SpecBadge = memo(function SpecBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs dark:border-slate-800 dark:bg-slate-900/60">
      <span className="font-medium text-slate-500 dark:text-slate-400">{label}:</span>
      <span className="font-semibold text-slate-900 dark:text-slate-200">{value}</span>
    </div>
  );
});

const ProductCard = memo(function ProductCard({ product }: { product: ProductView }) {
  const image = product.images?.[0]?.url;
  const hasSpecs = product.specifications && Object.keys(product.specifications).length > 0;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-blue-500/50 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col sm:flex-row">
        {/* Thumbnail / Image container */}
        <div className="relative flex aspect-square sm:aspect-auto sm:w-48 shrink-0 items-center justify-center overflow-hidden bg-slate-50 p-4 dark:bg-slate-800/40">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={product.name}
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-600">
              <InboxIcon width="32" height="32" />
              <span className="text-[10px]">No image</span>
            </div>
          )}
        </div>

        {/* Content details */}
        <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold leading-snug text-slate-900 dark:text-slate-50">
                <a
                  href={product.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {product.name}
                </a>
              </h3>
              <a
                href={product.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open scraped source page"
                className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <ExternalLinkIcon width="16" height="16" />
              </a>
            </div>

            {/* Badges / Category & Brand */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {product.category && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  <LayersIcon width="12" height="12" />
                  {product.category}
                </span>
              )}
              {product.brand && (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <TagIcon width="12" height="12" />
                  Brand: {product.brand}
                </span>
              )}
              {product.minimumOrderQuantity && (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <CheckCircleIcon width="12" height="12" />
                  MOQ: {product.minimumOrderQuantity}
                </span>
              )}
            </div>

            {/* Price Badge */}
            {product.price?.raw && (
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-lg font-bold text-slate-900 dark:text-slate-50">
                  {product.price.raw}
                </span>
              </div>
            )}

            {/* Specifications Grid */}
            {hasSpecs && (
              <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Specifications
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(product.specifications!).map(([key, val]) => (
                    <SpecBadge key={key} label={key} value={val} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export function ProductsTable({ products }: { products: ProductView[] }) {
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [search, setSearch] = useState("");

  const filteredProducts = products.filter((p) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.category?.toLowerCase().includes(term) ||
      p.brand?.toLowerCase().includes(term)
    );
  });

  return (
    <div data-testid="products-table" className="flex flex-col gap-4">
      {/* Controls Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Filter scraped products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 sm:w-64 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
        />

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">View:</span>
          <button
            onClick={() => setViewMode("cards")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              viewMode === "cards"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            Detailed Cards
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              viewMode === "table"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            Compact Table
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 dark:text-slate-600">
          <InboxIcon width="36" height="36" />
          <p className="mt-2 text-sm">No products found matching your filter.</p>
        </div>
      )}

      {/* Cards View */}
      {viewMode === "cards" && (
        <div className="flex flex-col gap-4">
          {filteredProducts.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th className="p-3 font-semibold text-slate-700 dark:text-slate-300">Product Name</th>
                <th className="p-3 font-semibold text-slate-700 dark:text-slate-300">Category</th>
                <th className="p-3 font-semibold text-slate-700 dark:text-slate-300">Brand</th>
                <th className="p-3 font-semibold text-slate-700 dark:text-slate-300">Price</th>
                <th className="p-3 font-semibold text-slate-700 dark:text-slate-300">MOQ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.map((product) => (
                <tr key={product._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-medium text-slate-900 dark:text-slate-50">
                    <a
                      href={product.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {product.name}
                    </a>
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">{product.category ?? "—"}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">{product.brand ?? "—"}</td>
                  <td className="p-3 font-semibold text-slate-900 dark:text-slate-50">{product.price?.raw ?? "—"}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">{product.minimumOrderQuantity ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
