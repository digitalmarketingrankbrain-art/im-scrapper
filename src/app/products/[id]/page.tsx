"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeftIcon, ExternalLinkIcon, InboxIcon, MailIcon, MapPinIcon, PhoneIcon } from "@/components/icons";
import { useProduct } from "@/hooks/useProducts";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading } = useProduct(id);

  if (isLoading) return <div className="p-8 text-sm text-slate-500 dark:text-slate-400">Loading…</div>;
  if (!product) return <div className="p-8 text-sm text-slate-500 dark:text-slate-400">Product not found</div>;

  const specs = Object.entries(product.specifications ?? {});

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-start gap-3">
        <Link
          href="/products"
          className="mt-0.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ChevronLeftIcon width="18" height="18" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{product.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
            {product.category && <span>{product.category}</span>}
            {product.subCategory && <span>&rsaquo; {product.subCategory}</span>}
            {product.price?.raw && <span className="font-medium text-slate-900 dark:text-slate-50">{product.price.raw}</span>}
            {product.minimumOrderQuantity && <span>MOQ: {product.minimumOrderQuantity}</span>}
            <a
              href={product.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-700 hover:underline dark:text-blue-400"
            >
              Source <ExternalLinkIcon width="12" height="12" />
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {product.images.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Images</h2>
              <div className="flex flex-wrap gap-3">
                {product.images.map((img, i) => (
                  <a key={i} href={img.url} target="_blank" rel="noopener noreferrer" className="block size-20 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={`${product.name} ${i + 1}`} className="size-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            </section>
          )}

          {product.images.length === 0 && (
            <section className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-16 dark:border-slate-700">
              <InboxIcon width="24" height="24" className="text-slate-300 dark:text-slate-700" />
              <p className="text-xs text-slate-400 dark:text-slate-500">No images captured</p>
            </section>
          )}

          {specs.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Specifications
              </h2>
              <table className="w-full text-sm">
                <tbody>
                  {specs.map(([key, value], i) => (
                    <tr key={key} className={i % 2 === 0 ? "bg-slate-50 dark:bg-slate-800/40" : ""}>
                      <td className="w-1/3 px-4 py-2 font-medium text-slate-500 dark:text-slate-400">{key}</td>
                      <td className="px-4 py-2 text-slate-900 dark:text-slate-50">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {product.description && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Description</h2>
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{product.description}</p>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Seller</h2>
            {product.seller ? (
              <div className="flex flex-col gap-2 text-sm">
                <Link href={`/sellers/${product.seller._id}`} className="font-medium text-blue-700 hover:underline dark:text-blue-400">
                  {product.seller.name}
                </Link>
                {product.seller.address?.raw && (
                  <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <MapPinIcon width="14" height="14" className="mt-0.5 shrink-0" />
                    {product.seller.address.raw}
                  </p>
                )}
                {product.seller.phone && product.seller.phone.length > 0 && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <PhoneIcon width="14" height="14" className="shrink-0" />
                    {product.seller.phone[0]}
                  </p>
                )}
                {product.seller.email && product.seller.email.length > 0 && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <MailIcon width="14" height="14" className="shrink-0" />
                    {product.seller.email[0]}
                  </p>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500">{product.seller.productCount} products from this seller</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500">No seller linked</p>
            )}
          </section>

          {product.brand && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Brand</h2>
              <p className="text-sm text-slate-900 dark:text-slate-50">{product.brand}</p>
              {product.model && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Model: {product.model}</p>}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
