import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import { extractCardDetails } from "./product";

describe("extractCardDetails", () => {
  it("reads specs from tables, 'Label: value' lines and key features from bullets", () => {
    const $ = cheerio.load(`
      <div id="c">
        <table><tr><td>Brand</td><td>Acme</td></tr></table>
        <div>Voltage: 36 V</div>
        <ul><li>Capacity: 10 Ah</li><li>Lightweight and long lasting</li></ul>
        <a>Get Latest Price</a>
      </div>`);
    const { specs, keyFeatures } = extractCardDetails($, $("#c"));
    expect(specs).toMatchObject({ Brand: "Acme", Voltage: "36 V", Capacity: "10 Ah" });
    expect(keyFeatures).toEqual({ Capacity: "10 Ah", feature_1: "Lightweight and long lasting" });
  });
});
