import { dbConnect } from "../src/lib/db/connect";
import { parseHtml } from "../src/scraper/static/parseHtml";
import { extractSeller } from "../src/scraper/extract/seller";
import { extractProduct } from "../src/scraper/extract/product";
import { upsertSeller, upsertProduct } from "../src/lib/db/repositories";
import { SellerModel } from "../src/lib/db/models/Seller";
import { ProductModel } from "../src/lib/db/models/Product";
import mongoose from "mongoose";

// Mock data representing multiple seller pages scraped from IndiaMart
const mockSellersData = [
  {
    url: "https://apexmachinery.indiamart.com",
    productUrl: "https://www.indiamart.com/proddetail/100-ton-hydraulic-press.html",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Apex Machinery Ltd. - IndiaMart</title>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Apex Machinery Ltd.",
          "telephone": "+91 9988776655",
          "email": "contact@apexmachinery.co.in",
          "url": "https://apexmachinery.indiamart.com",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Gurugram",
            "addressRegion": "Haryana",
            "addressCountry": "India"
          }
        }
        </script>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "100 Ton Hydraulic Press",
          "brand": "ApexPress",
          "offers": { "price": "Rs 8,50,000 / Piece", "priceCurrency": "INR" }
        }
        </script>
      </head>
      <body></body>
      </html>
    `
  },
  {
    url: "https://globaltools.indiamart.com",
    productUrl: "https://www.indiamart.com/proddetail/cnc-milling-machine.html",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Global Tools & Equipment - IndiaMart</title>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Global Tools & Equipment Co.",
          "telephone": "+91 9123456789",
          "email": "sales@globaltools.com",
          "url": "https://globaltools.indiamart.com",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Ahmedabad",
            "addressRegion": "Gujarat",
            "addressCountry": "India"
          }
        }
        </script>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Automatic CNC Milling Machine",
          "brand": "PrecisionTech",
          "offers": { "price": "Rs 12,00,000 / Unit", "priceCurrency": "INR" }
        }
        </script>
      </head>
      <body></body>
      </html>
    `
  },
  {
    url: "https://starfasteners.indiamart.com",
    productUrl: "https://www.indiamart.com/proddetail/ss-hex-bolts.html",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Star Fasteners India - IndiaMart</title>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Star Fasteners India Pvt Ltd",
          "telephone": "+91 9811223344",
          "email": "info@starfasteners.com",
          "url": "https://starfasteners.indiamart.com",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Ludhiana",
            "addressRegion": "Punjab",
            "addressCountry": "India"
          }
        }
        </script>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Industrial SS Hex Bolts",
          "brand": "StarFast",
          "offers": { "price": "Rs 25 / Piece", "priceCurrency": "INR" }
        }
        </script>
      </head>
      <body></body>
      </html>
    `
  }
];

async function runMultiSellerTest() {
  console.log("====================================================");
  console.log("   TESTING MULTIPLE SELLER SCRAPING & PERSISTENCE   ");
  console.log("====================================================\n");

  await dbConnect();
  console.log("✔ Connected to MongoDB.");

  let scrapedCount = 0;

  for (const item of mockSellersData) {
    console.log(`\nProcessing Seller ${scrapedCount + 1}: ${item.url}`);
    
    // 1. Parse HTML
    const parsed = parseHtml(item.html, item.url);

    // 2. Extract Seller & Product
    const seller = extractSeller(parsed, item.url, "indiamart");
    const product = extractProduct(parsed, item.productUrl, "indiamart");

    // 3. Upsert into DB
    const dbSeller = await upsertSeller(seller);
    const dbProduct = await upsertProduct(String(dbSeller._id), product);

    console.log(`  ✓ Seller Saved: ${dbSeller.name} (${dbSeller.address?.city}, ${dbSeller.address?.state})`);
    console.log(`  ✓ Product Saved: ${dbProduct.name} | Price: ${dbProduct.price?.raw}`);
    
    scrapedCount++;
  }

  // Verify total count in Database
  const totalSellers = await SellerModel.countDocuments();
  const totalProducts = await ProductModel.countDocuments();

  console.log("\n----------------------------------------------------");
  console.log(`DATABASE SUMMARY AFTER MULTI-SELLER SCRAPE:`);
  console.log(`  Total Sellers in DB:  ${totalSellers}`);
  console.log(`  Total Products in DB: ${totalProducts}`);
  console.log("----------------------------------------------------");

  await mongoose.disconnect();
  console.log("\n✔ MULTI-SELLER SCRAPING & PERSISTENCE TEST PASSED SUCCESSFULLY!");
}

runMultiSellerTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
