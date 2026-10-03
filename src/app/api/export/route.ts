import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";
// Imported for its side effect: populate("sellerId") needs the Seller model registered.
import "@/lib/db/models/Seller";
import { formatProductRow, toCsv } from "@/lib/export/csv";

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

  if (format === "csv") {
    const rows = products.map((product) => formatProductRow(product, product.sellerId));
    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="products-export.csv"`,
      },
    });
  }

  return NextResponse.json(products, {
    headers: { "Content-Disposition": `attachment; filename="products-export.json"` },
  });
}
