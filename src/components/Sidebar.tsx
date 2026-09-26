"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  BarChartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  CrawlIcon,
  DownloadIcon,
  InboxIcon,
  LayersIcon,
  MenuIcon,
  UsersIcon,
} from "@/components/icons";

const NAV_ITEMS = [
  { href: "/", label: "Scraper", icon: CrawlIcon },
  { href: "/dashboard", label: "Dashboard", icon: BarChartIcon },
  { href: "/jobs", label: "Job Monitor", icon: LayersIcon },
  { href: "/products", label: "Products", icon: InboxIcon },
  { href: "/sellers", label: "Sellers", icon: UsersIcon },
  { href: "/export", label: "Export", icon: DownloadIcon },
];

const COLLAPSE_KEY = "sidebar-collapsed";
let collapseListeners: (() => void)[] = [];

function subscribeCollapsed(listener: () => void) {
  collapseListeners.push(listener);
  return () => {
    collapseListeners = collapseListeners.filter((l) => l !== listener);
  };
}

function getCollapsedSnapshot() {
  return localStorage.getItem(COLLAPSE_KEY) === "true";
}

function getCollapsedServerSnapshot() {
  return false;
}

function setCollapsedPreference(next: boolean) {
  localStorage.setItem(COLLAPSE_KEY, String(next));
  collapseListeners.forEach((listener) => listener());
}

function BrandMark() {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white dark:bg-blue-600">
      <CrawlIcon width="18" height="18" />
    </div>
  );
}

function NavLinks({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ href, label, icon: ItemIcon }) => {
        const active = href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              collapsed ? "justify-center" : "gap-2.5"
            } ${
              active
                ? "bg-blue-700 text-white dark:bg-blue-600"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }`}
          >
            <ItemIcon />
            {!collapsed && label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeCollapsed, getCollapsedSnapshot, getCollapsedServerSnapshot);

  function toggleCollapsed() {
    setCollapsedPreference(!collapsed);
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:hidden dark:border-slate-800 dark:bg-slate-950">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <MenuIcon width="20" height="20" />
        </button>
        <BrandMark />
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">IndiaMart Seller Scraper</span>
      </header>

      {open && (
        <div className="fixed inset-0 z-30 sm:hidden">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[80vw] flex-col gap-6 bg-white py-4 shadow-xl dark:bg-slate-950">
            <div className="flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <BrandMark />
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">IndiaMart Scraper</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <CloseIcon width="20" height="20" />
              </button>
            </div>
            <NavLinks pathname={pathname} collapsed={false} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col gap-6 border-r border-slate-200 bg-white py-5 transition-[width] duration-200 sm:flex dark:border-slate-800 dark:bg-slate-950 ${
          collapsed ? "w-[4.5rem]" : "w-64"
        }`}
      >
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center px-2" : "px-4"}`}>
          <BrandMark />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-slate-900 dark:text-slate-50">
                IndiaMart Scraper
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Seller &amp; product data</p>
            </div>
          )}
        </div>
        <NavLinks pathname={pathname} collapsed={collapsed} />
        <div className="mt-auto px-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${
              collapsed ? "justify-center" : "gap-2.5"
            }`}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>
    </>
  );
}
