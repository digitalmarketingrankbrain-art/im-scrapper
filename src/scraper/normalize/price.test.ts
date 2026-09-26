import { describe, expect, it } from "vitest";
import { parseMoney } from "./price";

describe("parseMoney", () => {
  it("parses an INR price with a unit", () => {
    expect(parseMoney("₹ 1,250 / Piece")).toEqual({ raw: "₹ 1,250 / Piece", value: 1250, currency: "INR", unit: "Piece" });
  });

  it("parses a plain dollar amount", () => {
    const result = parseMoney("$99.99");
    expect(result.value).toBe(99.99);
    expect(result.currency).toBe("USD");
  });

  it("returns a null value when no number is present", () => {
    expect(parseMoney("Price on request").value).toBeNull();
  });

  it("returns a null currency when none is present", () => {
    expect(parseMoney("1250").currency).toBeNull();
  });
});
