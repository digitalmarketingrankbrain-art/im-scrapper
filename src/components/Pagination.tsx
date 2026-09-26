import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pages, total, onPageChange }: PaginationProps) {
  if (pages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <p className="text-slate-500 dark:text-slate-400">
        Page {page} of {pages} &middot; {total.toLocaleString()} total
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ChevronLeftIcon width="14" height="14" />
          Prev
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Next
          <ChevronRightIcon width="14" height="14" />
        </button>
      </div>
    </div>
  );
}
