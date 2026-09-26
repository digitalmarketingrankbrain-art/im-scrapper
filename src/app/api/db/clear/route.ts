import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { ScrapeJobModel } from "@/lib/db/models/ScrapeJob";
import { SellerModel } from "@/lib/db/models/Seller";
import { ProductModel } from "@/lib/db/models/Product";
import { CrawlPageModel } from "@/lib/db/models/CrawlPage";

export async function POST() {
  try {
    await dbConnect();
    
    await Promise.all([
      ScrapeJobModel.deleteMany({}),
      SellerModel.deleteMany({}),
      ProductModel.deleteMany({}),
      CrawlPageModel.deleteMany({}),
    ]);

    return NextResponse.json({
      status: "success",
      message: "Database cleared successfully. All sellers, products, jobs, and crawl logs removed.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { status: "error", message: `Failed to clear database: ${message}` },
      { status: 500 }
    );
  }
}
