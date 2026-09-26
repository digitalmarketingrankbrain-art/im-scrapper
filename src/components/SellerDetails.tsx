"use client";

import type { ReactNode } from "react";
import { CheckCircleIcon, ExternalLinkIcon, FileTextIcon, GlobeIcon, MailIcon, MapPinIcon, PhoneIcon, TagIcon, ClockIcon } from "@/components/icons";
import type { SellerView } from "@/types/dashboard";

function FieldCard({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        <span className="text-blue-600 dark:text-blue-400">{icon}</span>
        {label}
      </div>
      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{children}</div>
    </div>
  );
}

export function SellerDetails({ seller }: { seller: SellerView }) {
  return (
    <div data-testid="seller-details" className="flex flex-col gap-6">
      {/* Top Banner Card */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-slate-50/80 p-6 dark:border-slate-800 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                {seller.name}
              </h2>
              {seller.trustSeal && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                  <CheckCircleIcon width="14" height="14" />
                  TrustSEAL Verified Member
                </span>
              )}
            </div>
            {seller.businessType && (
              <p className="mt-1 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                🏢 {seller.businessType}
              </p>
            )}
            {seller.sourceUrl && (
              <a
                href={seller.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                View Scraped Store Page
                <ExternalLinkIcon width="12" height="12" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Grid Details */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {seller.phone && seller.phone.length > 0 && (
          <FieldCard icon={<PhoneIcon width="16" height="16" />} label="Phone Contact">
            <div className="flex flex-wrap gap-1.5">
              {seller.phone.map((ph) => (
                <a
                  key={ph}
                  href={`tel:${ph}`}
                  className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-xs hover:text-blue-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  📞 {ph}
                </a>
              ))}
            </div>
          </FieldCard>
        )}

        {seller.email && seller.email.length > 0 && (
          <FieldCard icon={<MailIcon width="16" height="16" />} label="Email Address">
            <div className="flex flex-wrap gap-1.5">
              {seller.email.map((em) => (
                <a
                  key={em}
                  href={`mailto:${em}`}
                  className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-xs hover:text-blue-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  ✉️ {em}
                </a>
              ))}
            </div>
          </FieldCard>
        )}

        {seller.website && (
          <FieldCard icon={<GlobeIcon width="16" height="16" />} label="Official Website">
            <a
              href={seller.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              {seller.website}
            </a>
          </FieldCard>
        )}

        {seller.address?.raw && (
          <FieldCard icon={<MapPinIcon width="16" height="16" />} label="Location / Address">
            <span className="text-xs leading-relaxed">{seller.address.raw}</span>
          </FieldCard>
        )}

        {seller.gstNumber && (
          <FieldCard icon={<TagIcon width="16" height="16" />} label="GSTIN / Tax ID">
            <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">{seller.gstNumber}</span>
          </FieldCard>
        )}

        {seller.yearOfEst && (
          <FieldCard icon={<ClockIcon width="16" height="16" />} label="Year of Est.">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{seller.yearOfEst}</span>
          </FieldCard>
        )}
      </div>

      {/* Description */}
      {seller.description && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <FileTextIcon width="14" height="14" />
            Company Description
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {seller.description}
          </p>
        </div>
      )}
    </div>
  );
}
