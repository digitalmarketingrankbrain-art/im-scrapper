import { describe, expect, it, vi } from "vitest";
import type { SingleProductResult } from "@/scraper/product/scrapeSingleProduct";
import { dedupeProductUrls, runProductBatch } from "./productBatch";

const u = (id: number) => `https://www.indiamart.com/proddetail/item-${2850000000000 + id}.html`;

const ok = (url: string): SingleProductResult => ({
  status: "ok", url, product: { name: url }, seller: { name: "S", sourceUrl: "s" }, specCount: 4, breadcrumb: [],
});
const skipped = (url: string): SingleProductResult => ({ status: "skipped", url, reason: "too_few_specs", specCount: 2, message: "2 specs" });
const failed = (url: string, retryable = false): SingleProductResult => ({
  status: "failed", url, error: { type: retryable ? "rate_limited" : "parsing_error", message: "nope" }, retryable,
});

const noSleep = { sleep: async () => undefined, spacingMs: 0 };

describe("runProductBatch", () => {
  it("one failed product does not stop the rest: A saved, B failed, C saved", async () => {
    const save = vi.fn(async () => undefined);
    const summary = await runProductBatch([u(1), u(2), u(3)], { ...noSleep, scrape: async (url) => (url === u(2) ? failed(url) : ok(url)), save });
    expect(summary.saved).toBe(2);
    expect(summary.failed.map((f) => f.url)).toEqual([u(2)]);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("an exception thrown while scraping or saving is contained too", async () => {
    const summary = await runProductBatch([u(1), u(2), u(3)], {
      ...noSleep,
      scrape: async (url) => {
        if (url === u(1)) throw new Error("scraper blew up");
        return ok(url);
      },
      save: async (r) => {
        if (r.url === u(2)) throw new Error("db down");
      },
    });
    expect(summary.saved).toBe(1);
    expect(summary.failed).toHaveLength(2);
  });

  it("skips invalid products without saving them", async () => {
    const save = vi.fn(async () => undefined);
    const summary = await runProductBatch([u(1), u(2)], { ...noSleep, scrape: async (url) => (url === u(1) ? skipped(url) : ok(url)), save });
    expect(summary).toMatchObject({ saved: 1, skipped: [{ url: u(1), reason: "too_few_specs" }], failed: [] });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("scrapes a product only once even if discovery found it through several links", async () => {
    const scrape = vi.fn(async (url: string) => ok(url));
    const same = "https://www.indiamart.com/proddetail/other-slug-2850000000001.html";
    await runProductBatch([u(1), same, u(1)], { ...noSleep, scrape, save: async () => undefined });
    expect(scrape).toHaveBeenCalledTimes(1);
    expect(dedupeProductUrls([u(1), same])).toHaveLength(1);
  });

  it("retries temporary failures later and counts the product when it then succeeds", async () => {
    let calls = 0;
    const summary = await runProductBatch([u(1), u(2)], {
      ...noSleep,
      scrape: async (url) => (url === u(1) && ++calls === 1 ? failed(url, true) : ok(url)),
      save: async () => undefined,
    });
    expect(summary).toMatchObject({ saved: 2, failed: [] });
  });

  it("reports a temporary failure that never recovers", async () => {
    const summary = await runProductBatch([u(1)], { ...noSleep, scrape: async (url) => failed(url, true), save: async () => undefined });
    expect(summary.failed).toHaveLength(1);
    expect(summary.failed[0].type).toBe("rate_limited");
  });
});
