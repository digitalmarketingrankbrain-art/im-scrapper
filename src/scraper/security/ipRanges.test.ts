import { describe, expect, it } from "vitest";
import { isPrivateIPv4, isPrivateIPv6 } from "./ipRanges";

describe("isPrivateIPv4", () => {
  it("flags loopback", () => {
    expect(isPrivateIPv4("127.0.0.1")).toBe(true);
  });

  it("flags 10.0.0.0/8", () => {
    expect(isPrivateIPv4("10.1.2.3")).toBe(true);
  });

  it("flags 172.16.0.0/12", () => {
    expect(isPrivateIPv4("172.16.0.1")).toBe(true);
    expect(isPrivateIPv4("172.31.255.255")).toBe(true);
    expect(isPrivateIPv4("172.32.0.1")).toBe(false);
  });

  it("flags 192.168.0.0/16", () => {
    expect(isPrivateIPv4("192.168.1.1")).toBe(true);
  });

  it("flags the link-local range including cloud metadata", () => {
    expect(isPrivateIPv4("169.254.169.254")).toBe(true);
  });

  it("allows a public address", () => {
    expect(isPrivateIPv4("8.8.8.8")).toBe(false);
  });
});

describe("isPrivateIPv6", () => {
  it("flags loopback", () => {
    expect(isPrivateIPv6("::1")).toBe(true);
  });

  it("flags link-local", () => {
    expect(isPrivateIPv6("fe80::1")).toBe(true);
  });

  it("flags unique local (fc00::/7)", () => {
    expect(isPrivateIPv6("fd12:3456::1")).toBe(true);
  });

  it("flags an IPv4-mapped private address", () => {
    expect(isPrivateIPv6("::ffff:127.0.0.1")).toBe(true);
  });

  it("allows a public address", () => {
    expect(isPrivateIPv6("2001:4860:4860::8888")).toBe(false);
  });
});
