import { describe, expect, it, vi } from "vitest";
import { detailPageHtml, FIXTURE_PHONE, specsOf } from "../extract/detailPage.fixture";
import type { ScrapeStaticResult } from "../index";
import { parseHtml } from "../static/parseHtml";
import { scrapeSingleProduct, type SellerPageCache } from "./scrapeSingleProduct";

const URL_ = "https://www.indiamart.com/proddetail/embroidery-machine-single-head-2857861993873.html";

function page(html: string, url = URL_): ScrapeStaticResult {
  return { ok: true, url, httpStatus: 200, fetchedAt: "now", renderedWith: "static", data: parseHtml(html, url) };
}

const ABOUT = `<div class="factsheet-table__row"><dt class="factsheet-table__label">Number of Employees</dt><dd class="factsheet-table__value">11 to 25 People</dd></div>
  <div class="factsheet-table__row"><dt class="factsheet-table__label">Annual Turnover</dt><dd class="factsheet-table__value">Rs. 1 - 2 Crore</dd></div>`;

/** Serves a product page for any /proddetail/ URL and the About Us page for the store. */
function fakeFetch(html: string) {
  return vi.fn(async (url: string): Promise<ScrapeStaticResult> => (url.endsWith("aboutus.html") ? page(ABOUT, url) : page(html, url)));
}

describe("scrapeSingleProduct", () => {
  it("skips a product with 2 specs, before looking at images or the seller page", async () => {
    const fetchPage = fakeFetch(detailPageHtml({ specs: specsOf(2) }));
    const result = await scrapeSingleProduct(URL_, { fetchPage });
    expect(result).toMatchObject({ status: "skipped", reason: "too_few_specs", specCount: 2 });
    expect(fetchPage).toHaveBeenCalledTimes(1); // product page only — the seller page was never fetched
  });

  it.each([0, 1])("skips a product with %i specs", async (count) => {
    const result = await scrapeSingleProduct(URL_, { fetchPage: fakeFetch(detailPageHtml({ specs: specsOf(count) })) });
    expect(result).toMatchObject({ status: "skipped", reason: "too_few_specs", specCount: count });
  });

  it.each([3, 4, 5])("saves a product with %i specs", async (count) => {
    const result = await scrapeSingleProduct(URL_, { fetchPage: fakeFetch(detailPageHtml({ specs: specsOf(count) })) });
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.specCount).toBe(count);
  });

  it("keeps at most 5 images, primary image first and in page order", async () => {
    const result = await scrapeSingleProduct(URL_, { fetchPage: fakeFetch(detailPageHtml({ galleryImages: 8 })) });
    if (result.status !== "ok") throw new Error("expected ok");
    const urls = result.product.images!.map((i) => i.url);
    expect(urls).toHaveLength(5);
    expect(urls[0]).toContain("/main/");
    expect(urls[1]).toContain("/g0/");
    expect(urls[4]).toContain("/g3/");
  });

  it("saves fewer images when fewer exist", async () => {
    const result = await scrapeSingleProduct(URL_, { fetchPage: fakeFetch(detailPageHtml({ galleryImages: 0 })) });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.product.images).toHaveLength(1);
  });

  it("maps breadcrumb crumb 2 -> subCategory and crumb 3 -> productType", async () => {
    const result = await scrapeSingleProduct(URL_, { fetchPage: fakeFetch(detailPageHtml()) });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.product.subCategory).toBe("Sewing,Knitting & Embroidery Machine");
    expect(result.product.productType).toBe("Embroidery Machine");
    expect(JSON.stringify(result.product)).not.toContain("Single Head Embroidery Machine"); // crumb 4 is never stored
    expect(result.product.category).not.toBe("IndiaMART");
  });

  it("copes with a page that has no breadcrumb", async () => {
    const result = await scrapeSingleProduct(URL_, { fetchPage: fakeFetch(detailPageHtml({ breadcrumb: null })) });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.product.subCategory).toBeUndefined();
    expect(result.product.productType).toBeUndefined();
  });

  it("returns seller details without any contact information, and keeps specs free of seller rows", async () => {
    const result = await scrapeSingleProduct(URL_, { fetchPage: fakeFetch(detailPageHtml()) });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.seller).toMatchObject({
      name: "TTM Embroidery",
      sourceUrl: "https://www.indiamart.com/sar-home-projects/",
      gstNumber: "37HXXPP0646E1ZU",
      legalStatus: "Sole Proprietorship (Individual)",
      address: { raw: "Visakhapatnam, Andhra Pradesh", city: "Visakhapatnam", state: "Andhra Pradesh" },
    });
    expect(result.seller.metadata).toMatchObject({ memberSince: "2023-01-18", gstRegistrationYear: "2026", gstLegalStatusOfFirm: "Proprietorship" });
    const everything = JSON.stringify(result);
    expect(everything).not.toContain("8047790754");
    expect(everything).not.toContain(FIXTURE_PHONE);
    expect(everything).not.toContain("Tarun");
    expect(everything).not.toMatch(/Contact Number/i);
    expect(result.seller).not.toHaveProperty("phone");
    expect(result.seller).not.toHaveProperty("email");
  });

  it("adds extra non-contact facts from the seller's own page, only filling gaps", async () => {
    const result = await scrapeSingleProduct(URL_, { fetchPage: fakeFetch(detailPageHtml()) });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.seller.numberOfEmployees).toBe("11 to 25 People");
    expect(result.seller.annualTurnover).toBe("Rs. 1 - 2 Crore");
    expect(result.seller.legalStatus).toBe("Sole Proprietorship (Individual)"); // product page value wins
  });

  it("reads each seller's page once across a whole batch", async () => {
    const fetchPage = fakeFetch(detailPageHtml());
    const sellerPages: SellerPageCache = new Map();
    for (const id of ["1", "2", "3"]) {
      await scrapeSingleProduct(`https://www.indiamart.com/proddetail/p-${id}.html`, { fetchPage, sellerPages });
    }
    expect(fetchPage.mock.calls.filter(([u]) => u.endsWith("aboutus.html"))).toHaveLength(1);
  });

  it("still returns the product when the seller page cannot be fetched", async () => {
    const fetchPage = vi.fn(async (url: string): Promise<ScrapeStaticResult> => {
      if (url.endsWith("aboutus.html")) throw new Error("boom");
      return page(detailPageHtml(), url);
    });
    expect((await scrapeSingleProduct(URL_, { fetchPage })).status).toBe("ok");
  });

  it("reports a fetch failure as `failed` instead of throwing", async () => {
    const fetchPage = vi.fn(
      async (): Promise<ScrapeStaticResult> => ({
        ok: false, url: URL_, httpStatus: 429, fetchedAt: "now", renderedWith: "static", error: { type: "rate_limited", message: "429" },
      }),
    );
    expect(await scrapeSingleProduct(URL_, { fetchPage })).toMatchObject({ status: "failed", retryable: true, error: { type: "rate_limited" } });
  });

  it("reports an unexpected exception as `failed` instead of throwing", async () => {
    const fetchPage = vi.fn(async () => {
      throw new Error("kaboom");
    });
    expect(await scrapeSingleProduct(URL_, { fetchPage })).toMatchObject({ status: "failed", error: { message: "kaboom" } });
  });

  it("skips a page that is not a product page", async () => {
    const result = await scrapeSingleProduct("https://www.indiamart.com/some-store/aboutus.html", { fetchPage: fakeFetch("<html><body>About us</body></html>") });
    expect(result).toMatchObject({ status: "skipped", reason: "not_a_product_page" });
  });
});
