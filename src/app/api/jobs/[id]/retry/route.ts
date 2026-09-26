import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { ScrapeJobModel } from "@/lib/db/models/ScrapeJob";
import { getScrapeQueue } from "@/lib/queue/scrapeQueue";

const RETRYABLE_STATUSES = new Set(["failed", "cancelled"]);

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbConnect();

  const job = await ScrapeJobModel.findById(id).catch(() => null);
  if (!job) {
    return NextResponse.json({ status: "error", message: "Job not found" }, { status: 404 });
  }
  if (!RETRYABLE_STATUSES.has(job.status)) {
    return NextResponse.json(
      { status: "error", message: `Only failed or cancelled jobs can be retried (job is ${job.status})` },
      { status: 400 },
    );
  }

  job.status = "pending";
  job.progress = 0;
  job.pagesDiscovered = 0;
  job.pagesProcessed = 0;
  job.productsFound = 0;
  job.productsProcessed = 0;
  job.errors = [];
  job.startedAt = undefined;
  job.completedAt = undefined;
  await job.save();

  const queue = getScrapeQueue();
  const existing = await queue.getJob(id);
  if (existing) await existing.remove();
  await queue.add("scrape", { jobId: id, sourceUrl: job.sourceUrl }, { jobId: id });

  return NextResponse.json(job);
}
