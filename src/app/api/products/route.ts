import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";

const SORTS: Record<string, Record<string, 1 | -1>> = {
  "createdAt:desc": { updatedAt: -1 },
  "createdAt:asc": { updatedAt: 1 },
  "price:asc": { "price.value": 1 },
  "price:desc": { "price.value": -1 },
  "name:asc": { name: 1 },
  "name:desc": { name: -1 },
};

export async function GET(request: NextRequest) {
  await dbConnect();
  const params = request.nextUrl.searchParams;

  const page = Math.max(1, Number(params.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 20));
  const category = params.get("category")?.trim();
  const sellerId = params.get("sellerId")?.trim();
  const search = params.get("search")?.trim();
  const sort = SORTS[params.get("sort") ?? ""] ?? SORTS["createdAt:desc"];

  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;
  if (sellerId) filter.sellerId = sellerId;
  if (search) filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

  const [products, total] = await Promise.all([
    ProductModel.find(filter)
      .populate("sellerId", "name")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ProductModel.countDocuments(filter),
  ]);

  const data = products.map((product) => {
    const seller = product.sellerId as unknown as { _id: unknown; name: string } | null;
    return {
      _id: product._id,
      name: product.name,
      category: product.category,
      subCategory: product.subCategory,
      brand: product.brand,
      price: product.price,
      minimumOrderQuantity: product.minimumOrderQuantity,
      images: product.images ?? [],
      sourceUrl: product.sourceUrl,
      sellerId: seller?._id ?? null,
      sellerName: seller?.name,
      scrapedAt: product.scrapedAt,
    };
  });

  return NextResponse.json({
    data,
    meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  });
}
