import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { SellerModel } from "@/lib/db/models/Seller";

export async function GET(request: NextRequest) {
  await dbConnect();
  const params = request.nextUrl.searchParams;

  const page = Math.max(1, Number(params.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 30));
  const search = params.get("search")?.trim();
  const letter = params.get("letter")?.trim();

  const filter: Record<string, unknown> = {};
  if (search) filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  else if (letter && /^[A-Za-z]$/.test(letter)) filter.name = { $regex: `^${letter}`, $options: "i" };

  const [rows, total] = await Promise.all([
    SellerModel.aggregate([
      { $match: filter },
      { $sort: { name: 1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $lookup: { from: "products", localField: "_id", foreignField: "sellerId", as: "products" } },
      { $addFields: { productCount: { $size: "$products" } } },
      { $project: { products: 0 } },
    ]),
    SellerModel.countDocuments(filter),
  ]);

  return NextResponse.json({
    data: rows,
    meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  });
}
