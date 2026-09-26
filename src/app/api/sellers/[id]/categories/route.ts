import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbConnect();

  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ status: "error", message: "Invalid seller id" }, { status: 400 });
  }

  const rows = await ProductModel.aggregate([
    { $match: { sellerId: new Types.ObjectId(id), category: { $nin: [null, ""] } } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return NextResponse.json((rows as { _id: string; count: number }[]).map((r) => ({ name: r._id, count: r.count })));
}
