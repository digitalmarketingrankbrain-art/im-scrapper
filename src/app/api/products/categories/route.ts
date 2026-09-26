import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";

export async function GET() {
  await dbConnect();
  const rows = await ProductModel.aggregate([
    { $match: { category: { $nin: [null, ""] } } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return NextResponse.json((rows as { _id: string; count: number }[]).map((r) => ({ name: r._id, count: r.count })));
}
