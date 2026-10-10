"use client";

import { useState } from "react";
import { DownloadIcon, FileTextIcon } from "@/components/icons";
import { useProductCategories } from "@/hooks/useProducts";
import { useSellers } from "@/hooks/useSellers";

type ExportFormat = "json" | "csv" | "xls" | "xlsx";

const FORMAT_HINTS: Record<ExportFormat, string> = {
  csv: "Flat CSV — one row per product, all columns",
  xlsx: "Excel workbook (.xlsx) — full upload sheet, all columns incl. seller",
  xls: "Legacy Excel sheet (.xls) — same columns as CSV",
  json: "Full nested JSON documents",
};

export default function ExportPage() {
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [category, setCategory] = useState("");
  const [sellerId, setSellerId] = useState("");

  const { data: categories = [] } = useProductCategories();
  const { data: sellersData } = useSellers({ page: 1, limit: 100 });
  const sellers = sellersData?.data ?? [];

  const query = new URLSearchParams({ format });
  if (category) query.set("category", category);
  if (sellerId) query.set("sellerId", sellerId);

  const scopeLabel =
    [sellers.find((s) => s._id === sellerId)?.name, category].filter(Boolean).join(", ") || "all products";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Export</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Download the scraped product catalog as JSON, CSV or Excel (.xlsx / .xls).
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Format</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["xlsx", "csv", "xls", "json"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                format === f
                  ? "border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-500/10"
                  : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
              }`}
            >
              <FileTextIcon width="16" height="16" className={format === f ? "text-blue-700 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"} />
              <span className="text-sm font-medium text-slate-900 uppercase dark:text-slate-50">{f}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {FORMAT_HINTS[f]}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.count})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Seller</label>
            <select
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="">All sellers</option>
              {sellers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Exporting <span className="font-medium text-slate-700 dark:text-slate-300">{scopeLabel}</span> as{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300 uppercase">{format}</span>
          </p>
          <a
            href={`/api/export?${query.toString()}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <DownloadIcon width="16" height="16" /> Download
          </a>
        </div>
      </section>
    </main>
  );
}
