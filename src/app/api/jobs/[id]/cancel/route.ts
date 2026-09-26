import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { ScrapeJobModel } from "@/lib/db/models/ScrapeJob";
import { getScrapeQueue } from "@/lib/queue/scrapeQueue";

/**
 * Only a still-queued job can be reliably cancelled — a running job's crawl has no
 * cancellation signal wired into it yet, so cancelling it here would just mismatch the
 * DB status against a crawl that keeps running and overwrites it on completion.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbConnect();

  const job = await ScrapeJobModel.findById(id).catch(() => null);
  if (!job) {
    return NextResponse.json({ status: "error", message: "Job not found" }, { status: 404 });
  }
  if (job.status !== "pending") {
    return NextResponse.json(
      { status: "error", message: `Only a pending (queued) job can be cancelled (job is ${job.status})` },
      { status: 400 },
    );
  }

  const existing = await getScrapeQueue().getJob(id);
  if (existing) await existing.remove();

  job.status = "cancelled";
  job.completedAt = new Date();
  await job.save();

  return NextResponse.json(job);
}
