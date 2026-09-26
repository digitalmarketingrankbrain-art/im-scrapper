import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { ScrapeJobModel } from "@/lib/db/models/ScrapeJob";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbConnect();

  const job = await ScrapeJobModel.findById(id).catch(() => null);
  if (!job) {
    return NextResponse.json({ status: "error", message: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(job);
}
