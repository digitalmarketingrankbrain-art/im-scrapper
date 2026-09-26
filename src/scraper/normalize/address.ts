import type { Address } from "@/types";

interface JsonLdAddress {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  addressCountry?: string | { name?: string };
}

/** Reads a schema.org PostalAddress object out of JSON-LD. Free-text addresses are Phase 5+ future work. */
export function addressFromJsonLd(value: unknown): Address | undefined {
  if (!value || typeof value !== "object") return undefined;
  const addr = value as JsonLdAddress;

  const country = typeof addr.addressCountry === "string" ? addr.addressCountry : addr.addressCountry?.name;
  const raw = [addr.streetAddress, addr.addressLocality, addr.addressRegion, country].filter(Boolean).join(", ");
  if (!raw) return undefined;

  return { raw, city: addr.addressLocality, state: addr.addressRegion, country };
}
