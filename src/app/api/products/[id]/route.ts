import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";
import { SellerModel } from "@/lib/db/models/Seller";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbConnect();

  const product = await ProductModel.findById(id).lean().catch(() => null);
  if (!product) {
    return NextResponse.json({ status: "error", message: "Product not found" }, { status: 404 });
  }

  const seller = product.sellerId ? await SellerModel.findById(product.sellerId).lean() : null;
  let productCount = 0;
  if (seller) {
    productCount = await ProductModel.countDocuments({ sellerId: seller._id });
  }

  return NextResponse.json({
    _id: product._id,
    name: product.name,
    description: product.description,
    category: product.category,
    subCategory: product.subCategory,
    brand: product.brand,
    model: product.model,
    price: product.price,
    minimumOrderQuantity: product.minimumOrderQuantity,
    specifications: product.specifications,
    images: product.images ?? [],
    sourceUrl: product.sourceUrl,
    sellerId: seller?._id ?? null,
    sellerName: seller?.name,
    scrapedAt: product.scrapedAt,
    seller: seller
      ? {
          _id: seller._id,
          name: seller.name,
          businessType: seller.businessType,
          address: seller.address,
          website: seller.website,
          phone: seller.phone,
          email: seller.email,
          categories: seller.categories,
          productCount,
          sourceUrl: seller.sourceUrl,
          scrapedAt: seller.scrapedAt,
        }
      : null,
  });
}
