import { describe, expect, it } from "vitest";
import { parseHtml } from "../static/parseHtml";
import { extractBreadcrumb, mapBreadcrumb } from "./breadcrumb";
import { detailPageHtml } from "./detailPage.fixture";

describe("breadcrumb mapping", () => {
  it("ignores crumbs 1 and 4, stores crumb 2 as sub_category and crumb 3 as product_type", () => {
    expect(mapBreadcrumb(["IndiaMART", "Sewing,Knitting & Embroidery Machine", "Embroidery Machine", "Single Head Embroidery Machine"])).toEqual({
      subCategory: "Sewing,Knitting & Embroidery Machine",
      productType: "Embroidery Machine",
    });
  });

  it("never falls back to the last crumb", () => {
    const mapped = mapBreadcrumb(["IndiaMART", "Only Category"]);
    expect(mapped.subCategory).toBe("Only Category");
    expect(mapped.productType).toBeUndefined();
  });

  it("handles an empty or one-element breadcrumb without throwing", () => {
    expect(mapBreadcrumb([])).toEqual({ subCategory: undefined, productType: undefined });
    expect(mapBreadcrumb(["IndiaMART"])).toEqual({ subCategory: undefined, productType: undefined });
  });

  it("reads schema.org BreadcrumbList in position order", () => {
    const parsed = parseHtml(detailPageHtml(), "https://www.indiamart.com/proddetail/x-2857861993873.html");
    expect(extractBreadcrumb(parsed)).toEqual(["IndiaMART", "Sewing,Knitting & Embroidery Machine", "Embroidery Machine", "Single Head Embroidery Machine"]);
  });

  it("falls back to the visible breadcrumb bar when there is no JSON-LD", () => {
    const html = `<html><body><nav class="pb10 vcrmb brdcmbBleedEdgePdp2"><a>IndiaMART</a> &gt; <a>Cat A</a> &gt; <a>Type B</a> &gt; <span>Product C</span></nav></body></html>`;
    expect(extractBreadcrumb(parseHtml(html, "https://www.indiamart.com/x"))).toEqual(["IndiaMART", "Cat A", "Type B", "Product C"]);
  });

  it("returns an empty list when the page has no breadcrumb at all", () => {
    expect(extractBreadcrumb(parseHtml("<html><body>hi</body></html>", "https://www.indiamart.com/x"))).toEqual([]);
  });
});
