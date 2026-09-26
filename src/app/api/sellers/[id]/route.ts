import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";
import { SellerModel } from "@/lib/db/models/Seller";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbConnect();

  const seller = await SellerModel.findById(id).lean().catch(() => null);
  if (!seller) {
    return NextResponse.json({ status: "error", message: "Seller not found" }, { status: 404 });
  }

  const productCount = await ProductModel.countDocuments({ sellerId: seller._id });

  return NextResponse.json({ ...seller, productCount });
}
