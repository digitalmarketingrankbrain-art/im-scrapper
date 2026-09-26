import { dbConnect } from "../src/lib/db/connect";
import { scrapePage } from "../src/scraper";
import { extractSeller } from "../src/scraper/extract/seller";
import { extractProduct } from "../src/scraper/extract/product";
import mongoose from "mongoose";

const targetUrl = "https://www.indiamart.com/ananda-enterprises-gaya/?pid=2859589789733&c_id=863&mid=108093&pn=Electric%20Scooter%20Lithium%20Battery";

async function testSingleUrl() {
  console.log("==========================================");
  console.log("  FETCHING & PARSING URL:");
  console.log(`  ${targetUrl}`);
  console.log("==========================================\n");

  await dbConnect();

  const result = await scrapePage(targetUrl, "dynamic");

  console.log("Scrape Success:", result.ok);
  console.log("Rendered With:", result.renderedWith);
  console.log("HTTP Status:", result.httpStatus);
  
  if (result.error) {
    console.log("Error:", result.error);
  }

  if (result.data) {
    console.log("Page Title:", result.data.title);

    const seller = extractSeller(result.data, targetUrl, "indiamart");
    const product = extractProduct(result.data, targetUrl, "indiamart");

    console.log("\n==========================================");
    console.log("  EXTRACTED SELLER DETAILS");
    console.log("==========================================");
    console.dir(seller, { depth: null });

    console.log("\n==========================================");
    console.log("  EXTRACTED PRODUCT DETAILS");
    console.log("==========================================");
    console.dir(product, { depth: null });
  }

  await mongoose.disconnect();
}

testSingleUrl().catch((err) => {
  console.error("Scrape failed:", err);
  process.exit(1);
});
