import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });

  it("writes a header row followed by data rows", () => {
    const csv = toCsv([
      { name: "Widget", price: 10 },
      { name: "Gadget", price: 20 },
    ]);
    expect(csv).toBe("name,price\nWidget,10\nGadget,20");
  });

  it("quotes values containing commas or quotes", () => {
    const csv = toCsv([{ name: 'Foo, "Bar"' }]);
    expect(csv).toBe('name\n"Foo, ""Bar"""');
  });

  it("renders null/undefined as an empty field", () => {
    expect(toCsv([{ name: "Widget", brand: undefined }])).toBe("name,brand\nWidget,");
  });

  it("neutralizes formula-triggering leading characters (CSV injection)", () => {
    expect(toCsv([{ name: "=HYPERLINK(\"http://evil.example\")" }])).toBe(
      "name\n\"'=HYPERLINK(\"\"http://evil.example\"\")\"",
    );
    expect(toCsv([{ name: "+1234" }])).toBe("name\n'+1234");
    expect(toCsv([{ name: "-1234" }])).toBe("name\n'-1234");
    expect(toCsv([{ name: "@SUM(A1:A2)" }])).toBe("name\n'@SUM(A1:A2)");
  });

  it("leaves ordinary values starting with digits or letters untouched", () => {
    expect(toCsv([{ name: "Widget" }])).toBe("name\nWidget");
  });
});
