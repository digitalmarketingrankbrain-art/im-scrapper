import { describe, expect, it } from "vitest";
import { extractFactsheet } from "./seller";
import { isProductDetailPage, mergeDetailIntoCard, productKeyUrl } from "./mergeDetail";
import { isStorefrontSectionPage } from "./product";

describe("storefront page classification", () => {
  it("flags seller-info sections but not product listings", () => {
    expect(isStorefrontSectionPage("https://www.indiamart.com/sar-home-projects/aboutus.html")).toBe(true);
    expect(isStorefrontSectionPage("https://www.indiamart.com/sar-home-projects/testimonial.html")).toBe(true);
    expect(isStorefrontSectionPage("https://www.indiamart.com/sar-home-projects/products-and-services.html")).toBe(false);
    expect(isStorefrontSectionPage("https://www.indiamart.com/sar-home-projects/embroidery-machine.html")).toBe(false);
  });

  it("recognises detail pages and ignores URL fragments when comparing", () => {
    expect(isProductDetailPage("https://www.indiamart.com/proddetail/x-1.html")).toBe(true);
    expect(isProductDetailPage("https://www.indiamart.com/store/x.html")).toBe(false);
    expect(productKeyUrl("https://a.com/p/x.html#123")).toBe(productKeyUrl("https://a.com/p/x.html?y=1"));
    // card link and detail page of the same product share IndiaMart's numeric id
    expect(productKeyUrl("https://www.indiamart.com/sar/?c_id=173&pid=2857861993873&pn=Embroidery+Machine")).toBe(
      productKeyUrl("https://www.indiamart.com/proddetail/embroidery-machine-single-head-2857861993873.html"),
    );
  });
});

describe("mergeDetailIntoCard", () => {
  it("keeps the card's name and category, takes specs and photos from the detail page", () => {
    const card = { name: "Single Head Embroidery Machine", category: "Embroidery Machine", images: [{ url: "https://i/a-250x250.jpg", source: "html" as const }] };
    const detail = {
      name: "Embroidery Machine",
      category: "TTM Embroidery",
      subCategory: "T Shirt, Cap",
      specifications: { "Needle Count": "15" },
      images: [{ url: "https://i/b.jpg", source: "json-ld" as const }, { url: "https://i/a-500x500.jpg", source: "json-ld" as const }],
    };
    const merged = mergeDetailIntoCard(card, detail);
    expect(merged.name).toBe(card.name);
    expect(merged.category).toBe("Embroidery Machine");
    expect(merged.subCategory).toBe("T Shirt, Cap");
    expect(merged.specifications).toEqual({ "Needle Count": "15" });
    expect(merged.images?.map((i) => i.url)).toEqual(["https://i/b.jpg", "https://i/a-500x500.jpg"]);
  });
});

describe("mergeDetailIntoCard category and price unit", () => {
  it("replaces a card category that is just the seller name with the detail page's real category", () => {
    const card = { name: "E Rickshaw", category: "Energy Electric Vehicles", price: { raw: "₹ 1,57,000", value: 157000, currency: "INR", unit: null } };
    const detail = { name: "E Rickshaw Loader", category: "Electric Rickshaw Three Wheeler", price: { raw: "157000", value: 157000, currency: "INR", unit: "Piece" } };
    const merged = mergeDetailIntoCard(card, detail, "Energy Electric Vehicles");
    expect(merged.category).toBe("Electric Rickshaw Three Wheeler");
    expect(merged.price?.unit).toBe("Piece");
  });
});

describe("extractFactsheet", () => {
  const html = `<div class="factsheet-table__row"><dt class="factsheet-table__label">Legal Status of Firm</dt><dd class="factsheet-table__value"><span>Proprietorship</span></dd></div>
    <div class="factsheet-table__row"><dt class="factsheet-table__label">Nature of Business</dt><dd class="factsheet-table__value"><span>NA</span></dd></div>
    <div class="factsheet-table__row"><dt class="factsheet-table__label">Number of Employees</dt><dd class="factsheet-table__value"><span>11 to 25 People</span></dd></div>
    <div class="factsheet-table__row"><dt class="factsheet-table__label">Annual Turnover</dt><dd class="factsheet-table__value"><span>NA</span></dd></div>
    <div class="factsheet-table__row"><dt class="factsheet-table__label">Year of Establishment</dt><dd class="factsheet-table__value"><span>2019</span></dd></div>`;

  it("reads filled rows and skips NA values", () => {
    expect(extractFactsheet(html)).toEqual({ legalStatus: "Proprietorship", numberOfEmployees: "11 to 25 People", yearOfEst: "2019" });
  });
});
