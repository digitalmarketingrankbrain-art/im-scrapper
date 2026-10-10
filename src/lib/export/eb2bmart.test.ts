import { describe, expect, it } from "vitest";
import {
  buildEb2bmartRecord,
  decodeEntities,
  EB2BMART_COLUMNS,
  parseDescription,
  toEb2bmartCsv,
  toFlatRow,
  toSnakeCase,
} from "./eb2bmart";

/** Header line copied from an Aajjo Scraper export (products_*.csv) — the upload format this must match. */
const AAJJO_HEADER =
  "product_name,price.amount,price.currency,priceUnit,sub_category,product_type,seller.name,seller.address,seller.state,seller.country,seller.contact_details,seller.logo_url,company.gst_number,company.business_type,company.years_established,company.number_of_employees,company.turnover,company.legal_status,images,description.summary,description.applications,description.benefits,description.call_to_action,description.key_features,specifications";

const seller = {
  name: "Kohinoor Sales Agency",
  address: { raw: "Mumbai, Maharashtra, India", state: "Maharashtra", country: "India" },
  gstNumber: "27ABCDE1234F1Z5",
  businessType: "Trader - Retailer",
  yearOfEst: "2015",
  phone: [],
};

const product = {
  name: "EMotorad X1 Electric Bicycle",
  category: "Electric Bicycle",
  subCategory: "",
  brand: "EMotorad",
  minimumOrderQuantity: "1 Piece",
  price: { raw: "₹ 45,000 / Piece", value: 45000, currency: "INR", unit: "Piece" },
  sourceUrl: "https://www.indiamart.com/kohinoor-salesagency/",
  specifications: { "Battery Voltage": "36 V", Color: "Black" },
  description: "A fast electric bicycle.",
  images: [{ url: "//5.imimg.com/data5/a/b/x.jpg" }, { url: "https://hm.imimg.com/dist/client/sprite.svg#icon" }],
};

describe("EB2BMART export format", () => {
  it("uses exactly the Aajjo CSV columns, in order", () => {
    expect(EB2BMART_COLUMNS.join(",")).toBe(AAJJO_HEADER);
    expect(toEb2bmartCsv([]).trimEnd()).toBe(AAJJO_HEADER);
  });

  it("maps an IndiaMart product into the nested record", () => {
    const record = buildEb2bmartRecord(product, seller);
    expect(record.product_name).toBe("EMotorad X1 Electric Bicycle");
    expect(record.price).toEqual({ amount: 45000, currency: "INR" });
    expect(record.priceUnit).toBe("Piece");
    expect(record.sub_category).toBe("Electric Bicycle");
    expect(record.company.years_established).toBe(2015);
    expect(record.seller.country).toBe("India");
    // snake_case spec keys, with brand/moq mirrored in like Aajjo does
    expect(record.specifications).toEqual({
      battery_voltage: "36 V",
      color: "Black",
      brand: "EMotorad",
      moq: "1 Piece",
    });
  });

  it("resolves protocol-relative image URLs and drops site-chrome assets", () => {
    expect(buildEb2bmartRecord(product, seller).images).toEqual(["https://5.imimg.com/data5/a/b/x.jpg"]);
  });

  it("prefers the S3 storageUrl once an image has one", () => {
    const withS3 = { ...product, images: [{ url: "https://5.imimg.com/x.jpg", storageUrl: "https://bucket.s3/x.webp" }] };
    expect(buildEb2bmartRecord(withS3, seller).images).toEqual(["https://bucket.s3/x.webp"]);
  });

  it("flattens to one CSV row with | joined images and JSON cells", () => {
    const row = toFlatRow(buildEb2bmartRecord(product, seller));
    expect(Object.keys(row)).toEqual([...EB2BMART_COLUMNS]);
    expect(row["price.amount"]).toBe("45000");
    expect(row.specifications).toContain("Battery Voltage: 36 V; Color: Black");
    // No key-feature text on the page -> falls back to the leading specifications instead of an empty cell
    expect(row["description.key_features"]).toContain("Battery Voltage: 36 V");
  });

  it("quotes cells with commas/quotes/newlines and leaves +/- values untouched", () => {
    const csv = toEb2bmartCsv([
      buildEb2bmartRecord({ ...product, name: 'Bike, 26" wheel', description: "line1\n\nline2" }, { ...seller, phone: ["+91-1234567890"] }),
    ]);
    expect(csv).toContain('"Bike, 26"" wheel"');
    expect(csv).toContain("+91-1234567890");
    expect(csv).not.toContain("'+91");
  });

  it("splits labelled descriptions into sections", () => {
    const parsed = parseDescription(
      "Great product.\n\nKey Features: Material: Steel, Color: Red\n\nApplications: Factories\n\nWhy Choose This Product: Reliable\n\nOrder now.",
    );
    expect(parsed.summary).toBe("Great product.");
    expect(parsed.key_features).toEqual({ material: "Steel", color: "Red" });
    expect(parsed.applications).toBe("Factories");
    expect(parsed.benefits).toBe("Reliable");
    expect(parsed.call_to_action).toBe("Order now.");
  });

  it("decodes entities and snake-cases names", () => {
    expect(decodeEntities("40&quot; &amp; 50&#39;")).toBe("40\" & 50'");
    expect(toSnakeCase("Battery Voltage (V)")).toBe("battery_voltage_v");
    expect(toSnakeCase("countryOfOrigin")).toBe("country_of_origin");
  });
});
