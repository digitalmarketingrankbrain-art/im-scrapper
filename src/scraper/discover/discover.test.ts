import { describe, expect, it } from "vitest";
import { parseHtml } from "../static/parseHtml";
import { collectProductUrls, detectScrapeMode } from "./index";

describe("detectScrapeMode", () => {
  it.each([
    ["https://www.indiamart.com/proddetail/embroidery-machine-single-head-2857861993873.html", "product"],
    ["https://www.indiamart.com/sar-home-projects/?pid=2857861993873&c_id=173&pn=Embroidery", "product"],
    ["https://www.indiamart.com/sar-home-projects/", "catalog"],
    ["https://www.indiamart.com/sar-home-projects/products-and-services.html", "catalog"],
    ["https://www.indiamart.com/sar-home-projects/embroidery-machine.html", "catalog"],
    ["https://dir.indiamart.com/impcat/embroidery-machine.html", "listing"],
    ["https://dir.indiamart.com/search.mp?ss=embroidery+machine", "listing"],
    ["https://www.indiamart.com/impcat/embroidery-machine.html", "listing"],
  ])("%s -> %s", (url, mode) => {
    expect(detectScrapeMode(url)).toBe(mode);
  });
});

describe("collectProductUrls", () => {
  const base = "https://www.indiamart.com/sar-home-projects/embroidery-machine.html";

  it("collects only product pages, resolving protocol-relative links", () => {
    const html = `<a href="//www.indiamart.com/proddetail/single-head-2858855429230.html">a</a>
      <a href="/sar-home-projects/aboutus.html">about</a>
      <a href="https://www.facebook.com/share">fb</a>`;
    expect(collectProductUrls(parseHtml(html, base), base)).toEqual(["https://www.indiamart.com/proddetail/single-head-2858855429230.html"]);
  });

  it("counts a product linked twice (or with tracking params / fragments) once", () => {
    const html = `<a href="/proddetail/x-2858855429230.html">a</a><a href="/proddetail/x-2858855429230.html#reviews">b</a><a href="/proddetail/x-2858855429230.html?utm=1">c</a><a href="/proddetail/y-2857838780888.html">d</a>`;
    expect(collectProductUrls(parseHtml(html, base), base)).toHaveLength(2);
  });

  it("also reads product URLs from the embedded listing data", () => {
    const next = { props: { pageProps: { serviceRes: { Data: [{ PDP_CANONICAL_URL: "https://www.indiamart.com/proddetail/z-2851677767355.html" }] } } } };
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(next)}</script>`;
    expect(collectProductUrls(parseHtml(html, base), base)).toEqual(["https://www.indiamart.com/proddetail/z-2851677767355.html"]);
  });
});
