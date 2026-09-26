import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";
import { ScrapeJobModel } from "@/lib/db/models/ScrapeJob";
import { SellerModel } from "@/lib/db/models/Seller";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbConnect();

  const job = await ScrapeJobModel.findById(id).catch(() => null);
  if (!job) {
    return NextResponse.json({ status: "error", message: "Job not found" }, { status: 404 });
  }

  const seller = job.sellerId ? await SellerModel.findById(job.sellerId) : null;
  const products = job.sellerId ? await ProductModel.find({ sellerId: job.sellerId }) : [];

  return NextResponse.json({ job, seller, products });
}
