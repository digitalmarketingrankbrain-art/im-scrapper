import { describe, expect, it } from "vitest";
import { normalizeUrl } from "./normalizeUrl";

describe("normalizeUrl", () => {
  it("strips the fragment", () => {
    expect(normalizeUrl("https://example.com/page#section")).toBe("https://example.com/page");
  });

  it("lower-cases the hostname", () => {
    expect(normalizeUrl("https://Example.COM/page")).toBe("https://example.com/page");
  });

  it("sorts query params for stable dedup", () => {
    expect(normalizeUrl("https://example.com/page?b=2&a=1")).toBe(normalizeUrl("https://example.com/page?a=1&b=2"));
  });

  it("drops the default port", () => {
    expect(normalizeUrl("https://example.com:443/page")).toBe("https://example.com/page");
  });

  it("drops a trailing slash on non-root paths", () => {
    expect(normalizeUrl("https://example.com/page/")).toBe("https://example.com/page");
  });

  it("keeps the root path as-is", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("resolves relative URLs against a base", () => {
    expect(normalizeUrl("/page", "https://example.com")).toBe("https://example.com/page");
  });

  it("rejects non-http(s) protocols", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("mailto:test@example.com")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(normalizeUrl("not a url")).toBeNull();
  });
});
