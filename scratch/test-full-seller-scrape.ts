import { dbConnect } from "../src/lib/db/connect";
import { processScrapeJob } from "../src/lib/queue/processScrapeJob";
import { ScrapeJobModel } from "../src/lib/db/models/ScrapeJob";
import { SellerModel } from "../src/lib/db/models/Seller";
import { ProductModel } from "../src/lib/db/models/Product";
import mongoose from "mongoose";

const sellerUrl = "https://www.indiamart.com/ananda-enterprises-gaya/";

async function runFullSellerTest() {
  console.log("====================================================");
  console.log("  TESTING FULL SELLER CATALOG CRAWL & MULTI-PRODUCT SCRAPE");
  console.log(`  Target: ${sellerUrl}`);
  console.log("====================================================\n");

  await dbConnect();

  // Clear previous test run data for clean output
  await ScrapeJobModel.deleteMany({ sourceUrl: sellerUrl });

  console.log("[1/3] Creating ScrapeJob in MongoDB...");
  const job = await ScrapeJobModel.create({ sourceUrl: sellerUrl, status: "pending" });
  console.log(`Job Created ID: ${job._id}`);

  console.log("\n[2/3] Executing processScrapeJob (Crawling seller catalog & extracting ALL products)...");
  await processScrapeJob(String(job._id), sellerUrl);

  const completedJob = await ScrapeJobModel.findById(job._id).lean();
  console.log("\n✔ Job Status:", completedJob?.status);
  console.log("✔ Pages Discovered:", completedJob?.pagesDiscovered);
  console.log("✔ Pages Processed:", completedJob?.pagesProcessed);
  console.log("✔ Products Found:", completedJob?.productsFound);
  console.log("✔ Products Processed:", completedJob?.productsProcessed);

  console.log("\n[3/3] Querying Extracted Seller & Products from MongoDB...");
  const seller = await SellerModel.findById(completedJob?.sellerId).lean();
  const products = await ProductModel.find({ sellerId: completedJob?.sellerId }).lean();

  console.log("\n==========================================");
  console.log("  EXTRACTED SELLER DETAILS");
  console.log("==========================================");
  console.log("Seller Name:", seller?.name);
  console.log("Address:", seller?.address);
  console.log("Description:", seller?.description);

  console.log("\n==========================================");
  console.log(`  EXTRACTED PRODUCTS COUNT: ${products.length}`);
  console.log("==========================================");
  products.forEach((p, index) => {
    console.log(`\nProduct ${index + 1}:`);
    console.log(`  Title: ${p.name}`);
    console.log(`  Category: ${p.category ?? "N/A"}`);
    console.log(`  Price: ${p.price?.raw ?? "N/A"}`);
    console.log(`  MOQ: ${p.minimumOrderQuantity ?? "N/A"}`);
    console.log(`  URL: ${p.sourceUrl}`);
  });

  await mongoose.disconnect();
  console.log("\n====================================================");
  console.log("  SUCCESS! ALL PRODUCTS OF SELLER SCRAPED & STORED");
  console.log("====================================================");
}

runFullSellerTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
