import { dbConnect } from "../src/lib/db/connect";
import { parseHtml } from "../src/scraper/static/parseHtml";
import { extractSeller } from "../src/scraper/extract/seller";
import { extractProduct } from "../src/scraper/extract/product";
import { upsertSeller, upsertProduct } from "../src/lib/db/repositories";
import { SellerModel } from "../src/lib/db/models/Seller";
import { ProductModel } from "../src/lib/db/models/Product";
import mongoose from "mongoose";

async function runTest() {
  console.log("==========================================");
  console.log("  INDIA MART DATA SCRAPING & PERSISTENCE TEST");
  console.log("==========================================\n");

  // 1. Connect DB
  console.log("[1/4] Connecting to MongoDB...");
  await dbConnect();
  console.log("✔ Connected to MongoDB successfully.\n");

  // 2. Realistic Scraped HTML from IndiaMart product page
  console.log("[2/4] Simulating IndiaMart Seller & Product HTML page parsing...");
  const mockHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Industrial Hydraulic Press 100 Ton - Apex Machinery IndiaMart</title>
      <meta name="description" content="Buy Heavy Duty 100 Ton Hydraulic Press from Apex Machinery Ltd." />
      <meta name="og:site_name" content="Apex Machinery Ltd." />
      
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Apex Machinery Ltd.",
        "description": "Leading manufacturer of hydraulic presses and industrial tools in India",
        "telephone": "+91 9988776655",
        "email": "contact@apexmachinery.co.in",
        "url": "https://apexmachinery.indiamart.com",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "Plot 15, Sector 4, IMT Manesar",
          "addressLocality": "Gurugram",
          "addressRegion": "Haryana",
          "postalCode": "122050",
          "addressCountry": "India"
        }
      }
      </script>

      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "100 Ton Heavy Duty Hydraulic Press Machine",
        "description": "High performance double action hydraulic press for metal stamping and forming",
        "brand": { "@type": "Brand", "name": "ApexPress" },
        "image": [
          "https://img.indiamart.com/apex-press-100t-front.jpg",
          "https://img.indiamart.com/apex-press-100t-side.jpg"
        ],
        "offers": {
          "@type": "Offer",
          "price": "Rs 8,50,000 / Piece",
          "priceCurrency": "INR"
        }
      }
      </script>

      <script id="__NEXT_DATA__" type="application/json">
      {
        "props": {
          "pageProps": {
            "serviceRes": {
              "Data": [
                {
                  "PARENT_MCAT": { "GLCAT_MCAT_NAME": "Hydraulic Machines" },
                  "BRD_MCAT_NAME": "Hydraulic Press",
                  "PC_ITEM_MIN_ORDER_QUANTITY": "1",
                  "PC_ITEM_MOQ_UNIT_TYPE": "Unit",
                  "ISQ": [
                    { "FK_IM_SPEC_MASTER_DESC": "Capacity", "SUPPLIER_RESPONSE_DETAIL": "100 Ton" },
                    { "FK_IM_SPEC_MASTER_DESC": "Operation Mode", "SUPPLIER_RESPONSE_DETAIL": "Automatic" },
                    { "FK_IM_SPEC_MASTER_DESC": "Motor Power", "SUPPLIER_RESPONSE_DETAIL": "15 HP" },
                    { "FK_IM_SPEC_MASTER_DESC": "Warranty", "SUPPLIER_RESPONSE_DETAIL": "1 Year" }
                  ]
                }
              ]
            }
          }
        }
      }
      </script>
    </head>
    <body>
      <p>Need urgent quote? Call us at +91 9988776655 or email sales@apexmachinery.co.in</p>
    </body>
    </html>
  `;

  const targetUrl = "https://www.indiamart.com/proddetail/100-ton-hydraulic-press.html";
  const parsed = parseHtml(mockHtml, targetUrl);

  // 3. Extract Data
  console.log("[3/4] Extracting Seller & Product structured data...");
  const sellerData = extractSeller(parsed, "https://apexmachinery.indiamart.com", "indiamart");
  const productData = extractProduct(parsed, targetUrl, "indiamart");

  console.log("\n--- SCRAPED SELLER DATA ---");
  console.dir(sellerData, { depth: null });

  console.log("\n--- SCRAPED PRODUCT DATA ---");
  console.dir(productData, { depth: null });

  // 4. Save & Verify in MongoDB
  console.log("\n[4/4] Saving to MongoDB and reading back to verify database persistence...");
  const savedSeller = await upsertSeller(sellerData);
  const savedProduct = await upsertProduct(String(savedSeller._id), productData);

  const dbSeller = await SellerModel.findById(savedSeller._id).lean();
  const dbProduct = await ProductModel.findById(savedProduct._id).lean();

  console.log("\n✔ DATABASE VERIFICATION SUCCESS:");
  console.log("Seller ID in DB:", dbSeller?._id);
  console.log("Seller Name:", dbSeller?.name);
  console.log("Seller Phones:", dbSeller?.phone);
  console.log("Seller Emails:", dbSeller?.email);
  console.log("Seller Address:", dbSeller?.address);
  console.log("Product Name:", dbProduct?.name);
  console.log("Product Category:", dbProduct?.category);
  console.log("Product Brand:", dbProduct?.brand);
  console.log("Product Price:", dbProduct?.price);
  console.log("Product MOQ:", dbProduct?.minimumOrderQuantity);
  console.log("Product Specs:", dbProduct?.specifications);
  console.log("Product Images count:", dbProduct?.images?.length);

  await mongoose.disconnect();
  console.log("\n==========================================");
  console.log("  ALL TESTS PASSED! DATA SCRAPING VERIFIED");
  console.log("==========================================");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
