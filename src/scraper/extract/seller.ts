import type { ScrapeSource, Seller } from "@/types";
import { addressFromJsonLd } from "../normalize/address";
import { extractEmails, extractPhones, normalizePhone } from "../normalize/contact";
import type { ParsedPage } from "../static/parseHtml";

interface JsonLdOrganization {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  telephone?: string;
  email?: string;
  address?: unknown;
  url?: string;
}

function findOrganization(jsonLd: unknown[]): JsonLdOrganization | undefined {
  for (const entry of jsonLd) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as JsonLdOrganization & { "@graph"?: unknown[] };
    const types = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]];
    if (types.some((t) => t === "Organization" || t === "LocalBusiness")) return obj;
    if (Array.isArray(obj["@graph"])) {
      const nested = findOrganization(obj["@graph"]);
      if (nested) return nested;
    }
  }
  return undefined;
}

/** Parses seller address from standard IndiaMart description pattern: "... offered by <Company> from <City>, <State>, <Country>" */
function parseAddressFromText(text: string | undefined) {
  if (!text) return undefined;
  const match = text.match(/from\s+([A-Za-z\s]+),\s*([A-Za-z\s]+),\s*([A-Za-z\s]+)/i);
  if (match) {
    return {
      city: match[1].trim(),
      state: match[2].trim(),
      country: match[3].trim(),
      raw: `${match[1].trim()}, ${match[2].trim()}, ${match[3].trim()}`,
    };
  }
  return undefined;
}

/** Extracts seller name cleanly, filtering out generic platform site names like "IndiaMART.com" */
function extractSellerName(orgName: string | undefined, siteName: string | undefined, title: string | null): string {
  if (orgName && !orgName.toLowerCase().includes("indiamart")) return orgName;
  if (siteName && !siteName.toLowerCase().includes("indiamart")) return siteName;
  if (title) {
    const companyPart = title.split("-")[0]?.trim();
    if (companyPart) {
      const nameOnly = companyPart.split(",")[0]?.trim();
      if (nameOnly) return nameOnly;
    }
  }
  return "Unknown Seller";
}

/** Extracts Business Type (e.g. "Trader - Wholesaler / Distributor / Manufacturer") */
function extractBusinessType(title: string | null, text: string): string | undefined {
  if (title && title.includes("-")) {
    const parts = title.split("-").map((p) => p.trim());
    if (parts.length > 1) {
      const types = parts.filter(
        (p) =>
          /trader|wholesaler|distributor|manufacturer|exporter|supplier|retailer|dealer/i.test(p)
      );
      if (types.length > 0) return types.join(" - ");
    }
  }
  const match = text.match(/(Manufacturer|Exporter|Wholesaler|Trader|Supplier|Distributor|Retailer|Service Provider)/gi);
  if (match) {
    return Array.from(new Set(match)).join(" / ");
  }
  return undefined;
}

/** Extracts Indian GSTIN number if present in textSample */
function extractGstNumber(text: string): string | undefined {
  const match = text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/);
  return match ? match[0] : undefined;
}

/** Extracts Year of Establishment if present */
function extractYearOfEst(text: string): string | undefined {
  const match = text.match(/(?:Year of Establishment|Established in|Estd\.?|Estd|Est\.?)\s*:?\s*(19\d\d|20\d\d)/i);
  return match ? match[1] : undefined;
}

/** Checks for TrustSEAL verification signal */
function checkTrustSeal(parsed: ParsedPage, url: string): boolean {
  if (url.includes("trustseal")) return true;
  if (parsed.links.some((l) => l.includes("trustseal"))) return true;
  return /TrustSEAL|Verified Supplier/i.test(parsed.textSample);
}

/** JSON-LD (schema.org Organization/LocalBusiness) is the primary source; meta tags and regex are fallbacks. */
export function extractSeller(parsed: ParsedPage, url: string, source: ScrapeSource): Partial<Seller> {
  const org = findOrganization(parsed.jsonLd);

  const name = extractSellerName(org?.name, parsed.metaTags["og:site_name"], parsed.title);
  const description = org?.description ?? parsed.metaTags["description"];

  const phones = new Set(extractPhones(parsed.textSample));
  if (org?.telephone) phones.add(normalizePhone(org.telephone));

  const emails = new Set(extractEmails(parsed.textSample));
  if (org?.email) emails.add(org.email.toLowerCase());

  const address = addressFromJsonLd(org?.address) ?? parseAddressFromText(description);

  return {
    source,
    sourceUrl: url,
    name,
    description,
    businessType: extractBusinessType(parsed.title, parsed.textSample),
    phone: [...phones],
    email: [...emails],
    address,
    website: org?.url,
    gstNumber: extractGstNumber(parsed.textSample),
    yearOfEst: extractYearOfEst(parsed.textSample),
    trustSeal: checkTrustSeal(parsed, url),
    scrapedAt: new Date(),
    updatedAt: new Date(),
  };
}
