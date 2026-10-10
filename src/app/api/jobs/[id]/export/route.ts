import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";
import { ScrapeJobModel } from "@/lib/db/models/ScrapeJob";
import { SellerModel } from "@/lib/db/models/Seller";
import {
  buildEb2bmartRecord,
  toEb2bmartCsv,
  toEb2bmartJson,
  toEb2bmartXls,
  toEb2bmartXlsx,
  XLS_CONTENT_TYPE,
} from "@/lib/export/eb2bmart";
import { XLSX_CONTENT_TYPE } from "@/lib/export/xlsx";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "json";
  if (format !== "json" && format !== "csv" && format !== "xls" && format !== "xlsx" && format !== "raw") {
    return NextResponse.json({ status: "error", message: "Invalid 'format', expected json, csv, xls, xlsx or raw" }, { status: 400 });
  }

  await dbConnect();
  const job = await ScrapeJobModel.findById(id).catch(() => null);
  if (!job) {
    return NextResponse.json({ status: "error", message: "Job not found" }, { status: 404 });
  }

  const seller = job.sellerId ? await SellerModel.findById(job.sellerId).lean() : null;
  const products = job.sellerId ? await ProductModel.find({ sellerId: job.sellerId }).lean() : [];

  // csv/json use the EB2BMART upload format; "raw" keeps the full internal documents (job + seller + products).
  const records = products.map((product) => buildEb2bmartRecord(product, seller));

  const fileName = `job-${id}-products`;
  if (format === "csv") {
    return new NextResponse(toEb2bmartCsv(records), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}.csv"`,
      },
    });
  }

  if (format === "xlsx") {
    return new NextResponse(new Uint8Array(toEb2bmartXlsx(records)), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="job-${id}-products.xlsx"`,
      },
    });
  }

  if (format === "xls") {
    return new NextResponse(toEb2bmartXls(records), {
      headers: {
        "Content-Type": XLS_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${fileName}.xls"`,
      },
    });
  }

  if (format === "json") {
    return new NextResponse(toEb2bmartJson(records), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${fileName}.json"`,
      },
    });
  }

  return NextResponse.json(
    { job, seller, products },
    { headers: { "Content-Disposition": `attachment; filename="job-${id}.json"` } },
  );
}
