import { describe, expect, it } from "vitest";
import { extractEmails, extractPhones } from "./contact";

describe("extractEmails", () => {
  it("finds and lower-cases emails from free text", () => {
    expect(extractEmails("Contact us at Sales@Example.com for more info")).toEqual(["sales@example.com"]);
  });

  it("dedupes repeated emails", () => {
    expect(extractEmails("a@example.com and a@example.com again")).toEqual(["a@example.com"]);
  });

  it("returns an empty array when there are none", () => {
    expect(extractEmails("no contact info here")).toEqual([]);
  });
});

describe("extractPhones", () => {
  it("finds a 10-digit Indian mobile number", () => {
    expect(extractPhones("Call us on 9876543210 today")).toEqual(["9876543210"]);
  });

  it("finds a number with the +91 prefix", () => {
    expect(extractPhones("+91 9876543210")).toEqual(["9876543210"]);
  });

  it("ignores digit runs that don't look like Indian mobiles", () => {
    expect(extractPhones("Order #1234567890123")).toEqual([]);
  });
});
