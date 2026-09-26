import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { ScrapeJobModel } from "@/lib/db/models/ScrapeJob";
import { ProductModel } from "@/lib/db/models/Product";
import { SellerModel } from "@/lib/db/models/Seller";
import { getScrapeQueue } from "@/lib/queue/scrapeQueue";
import type { JobStatus } from "@/types/dashboard";

const TREND_DAYS = 14;
const QUEUE_TIMEOUT_MS = 2000;

const JOB_STATUSES: JobStatus[] = ["pending", "running", "completed", "failed", "cancelled"];

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));
  try {
    return await Promise.race([promise, timeout]);
  } catch {
    return null;
  }
}

export async function GET() {
  await dbConnect();

  const trendSince = new Date();
  trendSince.setDate(trendSince.getDate() - (TREND_DAYS - 1));
  trendSince.setHours(0, 0, 0, 0);

  const [
    statusCounts,
    trendRows,
    durationAgg,
    totalsAgg,
    totalProducts,
    totalSellers,
    topCategories,
    topBrands,
    errorTypes,
    queueCounts,
  ] = await Promise.all([
    ScrapeJobModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ScrapeJobModel.aggregate([
      { $match: { createdAt: { $gte: trendSince } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    ScrapeJobModel.aggregate([
      { $match: { status: "completed", startedAt: { $ne: null }, completedAt: { $ne: null } } },
      { $project: { durationMs: { $subtract: ["$completedAt", "$startedAt"] } } },
      { $group: { _id: null, avgDurationMs: { $avg: "$durationMs" } } },
    ]),
    ScrapeJobModel.aggregate([
      { $group: { _id: null, pagesProcessed: { $sum: "$pagesProcessed" }, productsFound: { $sum: "$productsFound" } } },
    ]),
    ProductModel.countDocuments(),
    SellerModel.countDocuments(),
    ProductModel.aggregate([
      { $match: { category: { $nin: [null, ""] } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    ProductModel.aggregate([
      { $match: { brand: { $nin: [null, ""] } } },
      { $group: { _id: "$brand", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    ScrapeJobModel.aggregate([
      { $unwind: "$errors" },
      { $group: { _id: "$errors.type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    withTimeout(getScrapeQueue().getJobCounts("waiting", "active", "completed", "failed", "delayed"), QUEUE_TIMEOUT_MS),
  ]);

  const byStatus = Object.fromEntries(JOB_STATUSES.map((status) => [status, 0])) as Record<JobStatus, number>;
  for (const row of statusCounts as { _id: JobStatus; count: number }[]) {
    byStatus[row._id] = row.count;
  }
  const total = JOB_STATUSES.reduce((sum, status) => sum + byStatus[status], 0);
  const finished = byStatus.completed + byStatus.failed + byStatus.cancelled;

  const totals = (totalsAgg[0] as { pagesProcessed?: number; productsFound?: number } | undefined) ?? {};

  return NextResponse.json({
    jobs: {
      total,
      byStatus,
      successRate: finished > 0 ? byStatus.completed / finished : null,
      avgDurationMs: (durationAgg[0] as { avgDurationMs?: number } | undefined)?.avgDurationMs ?? null,
      totalPagesProcessed: totals.pagesProcessed ?? 0,
      totalProductsFound: totals.productsFound ?? 0,
      trend: (trendRows as { _id: string; count: number }[]).map((row) => ({ date: row._id, count: row.count })),
    },
    catalog: {
      totalProducts,
      totalSellers,
      topCategories: (topCategories as { _id: string; count: number }[]).map((row) => ({ name: row._id, count: row.count })),
      topBrands: (topBrands as { _id: string; count: number }[]).map((row) => ({ name: row._id, count: row.count })),
    },
    errors: (errorTypes as { _id: string; count: number }[]).map((row) => ({ name: row._id, count: row.count })),
    queue: queueCounts,
  });
}
