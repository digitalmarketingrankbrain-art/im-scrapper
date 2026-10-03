import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";
import { ScrapeJobModel } from "@/lib/db/models/ScrapeJob";
import { SellerModel } from "@/lib/db/models/Seller";
import { formatProductRow, toCsv } from "@/lib/export/csv";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "json";
  if (format !== "json" && format !== "csv") {
    return NextResponse.json({ status: "error", message: "Invalid 'format', expected json or csv" }, { status: 400 });
  }

  await dbConnect();
  const job = await ScrapeJobModel.findById(id).catch(() => null);
  if (!job) {
    return NextResponse.json({ status: "error", message: "Job not found" }, { status: 404 });
  }

  const seller = job.sellerId ? await SellerModel.findById(job.sellerId).lean() : null;
  const products = job.sellerId ? await ProductModel.find({ sellerId: job.sellerId }).lean() : [];

  if (format === "csv") {
    const rows = products.map((product) => formatProductRow(product, seller));
    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="job-${id}-products.csv"`,
      },
    });
  }

  return NextResponse.json(
    { job, seller, products },
    { headers: { "Content-Disposition": `attachment; filename="job-${id}.json"` } },
  );
}
