import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { ScrapeJobModel } from "@/lib/db/models/ScrapeJob";
import { getScrapeQueue } from "@/lib/queue/scrapeQueue";
import { processScrapeJob } from "@/lib/queue/processScrapeJob";
import { isSafeUrl } from "@/scraper/security/ssrf";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const sourceUrl = body?.sourceUrl;
  const concurrency = typeof body?.concurrency === "number" && body.concurrency >= 1 ? body.concurrency : undefined;

  if (!sourceUrl || typeof sourceUrl !== "string") {
    return NextResponse.json({ status: "error", message: "Missing 'sourceUrl' in request body" }, { status: 400 });
  }

  try {
    new URL(sourceUrl);
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid sourceUrl" }, { status: 400 });
  }

  if (!(await isSafeUrl(sourceUrl))) {
    return NextResponse.json(
      { status: "error", message: "sourceUrl resolves to a private/internal address" },
      { status: 400 },
    );
  }

  await dbConnect();
  const job = await ScrapeJobModel.create({ sourceUrl, status: "pending" });

  try {
    await getScrapeQueue().add("scrape", { jobId: String(job._id), sourceUrl, concurrency }, { jobId: String(job._id) });
  } catch (queueErr) {
    console.warn("Queue dispatch failed, falling back to direct background execution:", queueErr);
  }

  // Trigger immediate background execution so jobs never hang in pending
  processScrapeJob(String(job._id), sourceUrl, concurrency).catch((err) => {
    console.error(`ScrapeJob ${job._id} execution failed:`, err);
  });

  return NextResponse.json({ jobId: job._id, status: job.status }, { status: 201 });
}

/**
 * Without a `page` param, returns the plain last-50 array the home page's recent-jobs
 * list has always expected. With `page`, returns the paginated shape the Jobs page uses.
 */
export async function GET(request: NextRequest) {
  await dbConnect();
  const params = request.nextUrl.searchParams;
  const pageParam = params.get("page");

  if (!pageParam) {
    const jobs = await ScrapeJobModel.find().sort({ createdAt: -1 }).limit(50);
    return NextResponse.json(jobs);
  }

  const page = Math.max(1, Number(pageParam) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 20));
  const status = params.get("status");
  const search = params.get("search")?.trim();

  const filter: Record<string, unknown> = {};
  if (status && status !== "all") filter.status = status;
  if (search) filter.sourceUrl = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

  const [data, total] = await Promise.all([
    ScrapeJobModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    ScrapeJobModel.countDocuments(filter),
  ]);

  return NextResponse.json({
    data,
    meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  });
}
