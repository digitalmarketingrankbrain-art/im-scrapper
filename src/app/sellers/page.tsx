"use client";

import Link from "next/link";
import { useState } from "react";
import { Pagination } from "@/components/Pagination";
import { GlobeIcon, InboxIcon, MapPinIcon, SearchIcon, UsersIcon } from "@/components/icons";
import { useSellers } from "@/hooks/useSellers";

const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

export default function SellersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [letter, setLetter] = useState("");

  const { data, isLoading } = useSellers({ page, search: search || undefined, letter: letter || undefined });
  const sellers = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  function handleSearchChange(value: string) {
    setSearch(value);
    setLetter("");
    setPage(1);
  }

  function handleLetterSelect(l: string) {
    setLetter((prev) => (prev === l ? "" : l));
    setSearch("");
    setPage(1);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            <UsersIcon width="22" height="22" className="text-blue-600 dark:text-blue-500" />
            List of Sellers
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isLoading ? "Loading…" : `${total.toLocaleString()} sellers`}
            {letter && !isLoading && <span> — starting with {letter}</span>}
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" />
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search sellers…"
            className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          />
        </div>
      </header>

      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => {
            setLetter("");
            setSearch("");
            setPage(1);
          }}
          className={`h-7 min-w-[2.5rem] rounded px-2 text-xs font-medium transition-colors ${
            !letter && !search
              ? "bg-blue-700 text-white dark:bg-blue-600"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          }`}
        >
          All
        </button>
        {ALPHABET.map((l) => (
          <button
            key={l}
            onClick={() => handleLetterSelect(l)}
            className={`h-7 w-7 rounded text-xs font-medium transition-colors ${
              letter === l
                ? "bg-blue-700 text-white dark:bg-blue-600"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40" />
          ))}
        </div>
      )}

      {!isLoading && sellers.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 py-24 text-center dark:border-slate-700">
          <InboxIcon width="32" height="32" className="text-slate-300 dark:text-slate-700" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {search ? `No sellers matching "${search}"` : "No sellers found yet — scrape a seller page first"}
          </p>
        </div>
      )}

      {!isLoading && sellers.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sellers.map((seller) => (
            <Link
              key={seller._id}
              href={`/sellers/${seller._id}`}
              className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:border-blue-400 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/50 dark:hover:bg-slate-800/40"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                {seller.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 group-hover:text-blue-700 dark:text-slate-50 dark:group-hover:text-blue-400">
                  {seller.name}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  {seller.businessType && (
                    <span className="flex items-center gap-0.5 truncate">
                      <GlobeIcon width="10" height="10" className="shrink-0" />
                      {seller.businessType}
                    </span>
                  )}
                  {(seller.address?.state || seller.address?.country) && (
                    <span className="flex items-center gap-0.5 truncate">
                      <MapPinIcon width="10" height="10" className="shrink-0" />
                      {[seller.address?.state, seller.address?.country].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {seller.productCount}
              </span>
            </Link>
          ))}
        </div>
      )}

      {data && <Pagination page={data.meta.page} pages={data.meta.pages} total={data.meta.total} onPageChange={setPage} />}
    </main>
  );
}
