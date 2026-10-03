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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbConnect();

  const job = await ScrapeJobModel.findById(id).catch(() => null);
  if (!job) {
    return NextResponse.json({ status: "error", message: "Job not found" }, { status: 404 });
  }

  const { SellerModel } = await import("@/lib/db/models/Seller");
  const { ProductModel } = await import("@/lib/db/models/Product");

  if (job.sellerId) {
    const seller = await SellerModel.findById(job.sellerId).select("name").lean();
    if (seller) {
      // Downloaded images belong to the job data too — delete them with it.
      const { rm } = await import("node:fs/promises");
      const { sellerImageDir } = await import("@/lib/images/paths");
      await rm(sellerImageDir((seller as { name: string }).name, String(job.sellerId)), { recursive: true, force: true });
    }
    await ProductModel.deleteMany({ sellerId: job.sellerId });
    await SellerModel.findByIdAndDelete(job.sellerId);
  }
  await ScrapeJobModel.findByIdAndDelete(id);

  return NextResponse.json({
    status: "success",
    message: "Job and its associated seller and products deleted from database.",
  });
}
