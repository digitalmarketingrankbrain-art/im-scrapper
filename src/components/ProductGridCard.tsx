import Link from "next/link";
import { InboxIcon } from "@/components/icons";
import type { ProductListItem } from "@/types/dashboard";

export function ProductGridCard({ product }: { product: ProductListItem }) {
  const imgSrc = product.images?.[0]?.url;

  return (
    <Link
      href={`/products/${product._id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/50"
    >
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-800/40">
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={product.name}
            className="h-full w-full object-contain p-3 transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <InboxIcon width="28" height="28" className="text-slate-300 dark:text-slate-700" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3
          className="line-clamp-2 text-xs font-medium leading-snug text-slate-900 dark:text-slate-50"
          title={product.name}
        >
          {product.name}
        </h3>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {product.price?.raw ?? "Ask Price"}
          {product.minimumOrderQuantity && (
            <span className="ml-1 text-[10px] font-normal text-slate-500 dark:text-slate-400">
              MOQ {product.minimumOrderQuantity}
            </span>
          )}
        </p>
        {product.sellerName && (
          <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{product.sellerName}</p>
        )}
      </div>
    </Link>
  );
}
