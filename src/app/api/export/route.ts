import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";
// Imported for its side effect: populate("sellerId") needs the Seller model registered.
import "@/lib/db/models/Seller";
import { buildEb2bmartRecord, toEb2bmartCsv, toEb2bmartJson } from "@/lib/export/eb2bmart";

const EXPORT_LIMIT = 5000;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const format = params.get("format") ?? "json";
  if (format !== "json" && format !== "csv") {
    return NextResponse.json({ status: "error", message: "Invalid 'format', expected json or csv" }, { status: 400 });
  }

  const category = params.get("category")?.trim();
  const sellerId = params.get("sellerId")?.trim();
  const search = params.get("search")?.trim();

  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;
  if (sellerId) filter.sellerId = sellerId;
  if (search) filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

  await dbConnect();
  const products = await ProductModel.find(filter)
    .populate("sellerId")
    .sort({ updatedAt: -1 })
    .limit(EXPORT_LIMIT)
    .lean();

  // Same EB2BMART upload format as the per-job export.
  const records = products.map((product) => buildEb2bmartRecord(product, product.sellerId));

  if (format === "csv") {
    return new NextResponse(toEb2bmartCsv(records), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="products-export.csv"`,
      },
    });
  }

  return new NextResponse(toEb2bmartJson(records), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="products-export.json"`,
    },
  });
}
