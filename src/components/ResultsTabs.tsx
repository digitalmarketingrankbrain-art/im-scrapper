"use client";

import { ProductsTable } from "@/components/ProductsTable";
import { SellerDetails } from "@/components/SellerDetails";
import { DownloadIcon } from "@/components/icons";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setActiveTab, type ResultsTab } from "@/store/uiSlice";
import type { ProductView, SellerView } from "@/types/dashboard";

const TABS: ResultsTab[] = ["seller", "products"];

interface ResultsTabsProps {
  seller: SellerView | null;
  products: ProductView[];
}

export default function ResultsTabs({ seller, products }: ResultsTabsProps) {
  const activeTab = useAppSelector((state) => state.ui.activeTab);
  const selectedJobId = useAppSelector((state) => state.ui.selectedJobId);
  const dispatch = useAppDispatch();

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div className="flex gap-2">
          {TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => dispatch(setActiveTab(tab))}
                data-testid={`tab-${tab}`}
                className={`relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {tab}
                {tab === "products" && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {products.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Export Buttons */}
        {selectedJobId && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Export:</span>
            <a
              href={`/api/jobs/${selectedJobId}/export?format=csv`}
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <DownloadIcon width="14" height="14" />
              CSV
            </a>
            <a
              href={`/api/jobs/${selectedJobId}/export?format=json`}
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <DownloadIcon width="14" height="14" />
              JSON
            </a>
          </div>
        )}
      </div>

      <div className="p-6">
        {activeTab === "seller" && seller && <SellerDetails seller={seller} />}
        {activeTab === "products" && <ProductsTable products={products} />}
      </div>
    </section>
  );
}
