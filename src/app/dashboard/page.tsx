"use client";

import { Card } from "@/components/dashboard/Card";
import { JobStatusBreakdown } from "@/components/dashboard/JobStatusBreakdown";
import { JobsTrendChart } from "@/components/dashboard/JobsTrendChart";
import { QueueHealthPanel } from "@/components/dashboard/QueueHealthPanel";
import { RankedBarList } from "@/components/dashboard/RankedBarList";
import { StatCard } from "@/components/dashboard/StatCard";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { formatCompactNumber, formatDuration, formatPercent } from "@/lib/format";

function DashboardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
        ))}
      </div>
      <div className="h-72 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Track scraping activity, catalog growth, and system health.
        </p>
      </header>

      {isLoading || !stats ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total jobs" value={formatCompactNumber(stats.jobs.total)} />
            <StatCard label="Success rate" value={formatPercent(stats.jobs.successRate)} />
            <StatCard label="Products scraped" value={formatCompactNumber(stats.catalog.totalProducts)} />
            <StatCard label="Sellers scraped" value={formatCompactNumber(stats.catalog.totalSellers)} />
          </div>

          <Card title="Jobs over the last 14 days">
            <JobsTrendChart data={stats.jobs.trend} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Job status">
              <JobStatusBreakdown byStatus={stats.jobs.byStatus} />
            </Card>
            <Card title="Queue health">
              <QueueHealthPanel queue={stats.queue} />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Top categories">
              <RankedBarList items={stats.catalog.topCategories} />
            </Card>
            <Card title="Top brands">
              <RankedBarList items={stats.catalog.topBrands} />
            </Card>
          </div>

          <Card title="Error breakdown">
            {stats.errors.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">No errors recorded.</p>
            ) : (
              <RankedBarList items={stats.errors} tone="critical" />
            )}
          </Card>

          <p className="text-xs text-slate-400 dark:text-slate-500">
            Avg job duration: {formatDuration(stats.jobs.avgDurationMs)} &middot;{" "}
            {formatCompactNumber(stats.jobs.totalPagesProcessed)} pages processed &middot;{" "}
            {formatCompactNumber(stats.jobs.totalProductsFound)} products found across all jobs
          </p>
        </>
      )}
    </main>
  );
}
