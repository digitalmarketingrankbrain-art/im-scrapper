import { describe, expect, it } from "vitest";
import { isSameDomain } from "./domainPolicy";

describe("isSameDomain", () => {
  it("matches the exact host", () => {
    expect(isSameDomain("https://example.com/page", "example.com")).toBe(true);
  });

  it("matches a subdomain of the allowed host", () => {
    expect(isSameDomain("https://sub.example.com/page", "example.com")).toBe(true);
  });

  it("rejects a different domain", () => {
    expect(isSameDomain("https://evil.com/page", "example.com")).toBe(false);
  });

  it("rejects a domain that merely contains the allowed host as a substring", () => {
    expect(isSameDomain("https://notexample.com/page", "example.com")).toBe(false);
  });

  it("returns false for malformed URLs", () => {
    expect(isSameDomain("not a url", "example.com")).toBe(false);
  });
});
