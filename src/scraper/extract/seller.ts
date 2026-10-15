import * as cheerio from "cheerio";
import type { ScrapeSource, Seller } from "@/types";
import { addressFromJsonLd } from "../normalize/address";
import { extractEmails, extractPhones } from "../normalize/contact";
import type { ParsedPage } from "../static/parseHtml";

interface JsonLdOrganization {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  telephone?: string;
  email?: string;
  address?: unknown;
  url?: string;
  logo?: string | { url?: string };
}

function findOrganization(jsonLd: unknown[]): JsonLdOrganization | undefined {
  for (const entry of jsonLd) {
    if (!entry) continue;
    if (Array.isArray(entry)) {
      const nested = findOrganization(entry);
      if (nested) return nested;
      continue;
    }
    if (typeof entry !== "object") continue;
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
  const locMatch = text.match(/([A-Za-z\s]+),\s*([A-Za-z\s]+),\s*([A-Za-z\s]+)\s*GST/i);
  if (locMatch) {
    return {
      city: locMatch[1].trim(),
      state: locMatch[2].trim(),
      country: locMatch[3].trim(),
      raw: `${locMatch[1].trim()}, ${locMatch[2].trim()}, ${locMatch[3].trim()}`,
    };
  }
  return undefined;
}

/** Extracts seller name cleanly, filtering out generic platform site names like "IndiaMART.com" */
function extractSellerName(orgName: string | undefined, siteName: string | undefined, title: string | null, html?: string): string {
  if (orgName && !orgName.toLowerCase().includes("indiamart")) return orgName;
  if (html) {
    const c1Match = html.match(/class=["']c1_nam[^"']*["'][^>]*>\s*<a[^>]*>([^<]+)<\/a>/i);
    if (c1Match && c1Match[1]?.trim()) return c1Match[1].trim();
  }
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

/** Extracts Indian GSTIN number if present in text or rawHtml */
function extractGstNumber(text: string, html?: string): string | undefined {
  const fullContent = (text + " " + (html ?? "")).replace(/\s+/g, " ");
  const match = fullContent.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/);
  return match ? match[0] : undefined;
}

/** Extracts Year of Establishment if present */
export function extractYearOfEst(text: string): string | undefined {
  // Raw HTML puts tags / &nbsp; inside the phrase ("Established in<b>&nbsp;2015").
  text = text.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");
  const match = text.match(/(?:Year of Establishment|Established in|Estd\.?|Estd|Est\.?)\s*:?\s*(19\d\d|20\d\d)/i);
  return match ? match[1] : undefined;
}

export interface Factsheet {
  gstNumber?: string;
  legalStatus?: string;
  numberOfEmployees?: string;
  annualTurnover?: string;
  yearOfEst?: string;
}

const FACTSHEET_FIELDS: [keyof Factsheet, RegExp][] = [
  ["gstNumber", /^(gst( no\.?| number)?|gstin)$/i],
  ["legalStatus", /^legal status( of firm)?$/i],
  ["numberOfEmployees", /^(number of employees|no\.? of employees|total number of employees)$/i],
  ["annualTurnover", /^(annual turnover|turnover|annual turn over)$/i],
  ["yearOfEst", /^(year of establishment|establishment year|established in)$/i],
];

/** Reads the About Us "Factsheet" label/value rows (`<dt class="factsheet-table__label">` + `<dd>`); sellers only list the fields they filled in. */
export function extractFactsheet(rawHtml: string | undefined): Factsheet {
  if (!rawHtml) return {};
  const $ = cheerio.load(rawHtml);
  const out: Factsheet = {};
  $(".factsheet-table__row").each((_, row) => {
    const label = $(row).find(".factsheet-table__label").first().text().replace(/\s+/g, " ").trim();
    const value = $(row).find(".factsheet-table__value").first().text().replace(/\s+/g, " ").trim();
    if (!label || !value || /^(na|n\/a|-)$/i.test(value)) return;
    for (const [key, re] of FACTSHEET_FIELDS) {
      if (re.test(label) && !out[key]) out[key] = key === "yearOfEst" ? value.match(/(19|20)\d\d/)?.[0] : value;
    }
  });
  return out;
}

/** Phones from JSON-LD, `tel:` links and "Mobile / Phone / Call" labelled text. Bare 10-digit runs are not trusted: product ids look the same. */
function extractSellerPhones(org: JsonLdOrganization | undefined, rawHtml: string | undefined): string[] {
  const found = new Set<string>();
  if (org?.telephone) extractPhones(org.telephone).forEach((p) => found.add(p));
  if (rawHtml) {
    // IndiaMART ships the seller's public contact number in the page's embedded data ("Call Now" button).
    for (const m of rawHtml.matchAll(/"pnsNumber"\s*:\s*"([^"]+)"/g)) extractPhones(m[1]).forEach((p) => found.add(p));
    const $ = cheerio.load(rawHtml);
    $('a[href^="tel:"]').each((_, a) => {
      extractPhones(decodeURIComponent($(a).attr("href")!.slice(4))).forEach((p) => found.add(p));
    });
    const text = $.root().text().replace(/\s+/g, " ");
    for (const m of text.matchAll(/(?:mobile|phone|call|contact)\s*(?:no\.?|number)?\s*[:\-]?\s*((?:\+91[-\s]?)?[6-9]\d{9})\b/gi)) {
      extractPhones(m[1]).forEach((p) => found.add(p));
    }
  }
  return [...found];
}

/** Company logo: JSON-LD `logo`, else an `<img>` whose class/alt says logo — never IndiaMART's own site chrome or icon sprites. */
function extractLogoUrl(org: JsonLdOrganization | undefined, rawHtml: string | undefined, pageUrl: string): string | undefined {
  const resolve = (raw: string | undefined) => {
    if (!raw) return undefined;
    try {
      const url = new URL(raw.trim(), pageUrl).toString();
      return /imlogo|bl_mail_logo|sprite|\.svg(\?|#|$)|\/dist\/|\/template-mdc\//i.test(url) ? undefined : url;
    } catch {
      return undefined;
    }
  };
  const fromLd = resolve(typeof org?.logo === "string" ? org.logo : org?.logo?.url);
  if (fromLd) return fromLd;
  if (!rawHtml) return undefined;
  const fromData = resolve(rawHtml.match(/"companyLogo"\s*:\s*"([^"]+)"/)?.[1]?.replace(/\\\//g, "/"));
  if (fromData) return fromData;
  const $ = cheerio.load(rawHtml);
  for (const img of $("img").toArray()) {
    const hint = `${$(img).attr("class") ?? ""} ${$(img).attr("alt") ?? ""} ${$(img).attr("id") ?? ""}`;
    if (!/logo/i.test(hint) || /im-header-brand-logo|im logo|indiamart/i.test(hint)) continue;
    const url = resolve($(img).attr("data-src") ?? $(img).attr("src"));
    if (url) return url;
  }
  return undefined;
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

  const name = extractSellerName(org?.name, parsed.metaTags["og:site_name"], parsed.title, parsed.rawHtml);
  const description = org?.description ?? parsed.metaTags["description"];

  const phones = extractSellerPhones(org, parsed.rawHtml);

  const emails = new Set<string>();

  // 1. Check org.email
  if (org?.email) emails.add(org.email.toLowerCase());

  // 2. Check mailto: links in rawHtml
  if (parsed.rawHtml) {
    const mailtoMatches = parsed.rawHtml.match(/href=["']mailto:([^"'?]+)/gi);
    if (mailtoMatches) {
      mailtoMatches.forEach((m) => {
        const clean = m.replace(/^href=["']mailto:/i, "").trim().toLowerCase();
        if (clean && !clean.includes("indiamart.com")) emails.add(clean);
      });
    }
  }

  // 3. Extract direct & obfuscated emails from text and HTML
  const fullText = (parsed.textSample + " " + (parsed.rawHtml ?? "")).replace(/\s+/g, " ");
  const extractedList = extractEmails(fullText);
  extractedList.forEach((e) => {
    if (!e.includes("indiamart.com") && !e.includes("example.com") && !e.includes("domain.com")) {
      emails.add(e.toLowerCase());
    }
  });

  const obfMatches = fullText.match(/([a-zA-Z0-9._%+-]+)\s*(?:\[at\]|\(at\))\s*([a-zA-Z0-9.-]+)\s*(?:\[dot\]|\(dot\)|\.)\s*([a-zA-Z]{2,})/gi);
  if (obfMatches) {
    obfMatches.forEach((m) => {
      const clean = m.replace(/\s*(?:\[at\]|\(at\))\s*/i, "@").replace(/\s*(?:\[dot\]|\(dot\)|\.)\s*/i, ".").toLowerCase();
      if (!clean.includes("indiamart.com")) emails.add(clean);
    });
  }

  // 4. Fallback if no explicit email found
  if (emails.size === 0) {
    try {
      const parsedUrl = new URL(url);
      const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
      if (host && !host.includes("indiamart.com")) {
        emails.add(`info@${host}`);
      } else if (host.includes("indiamart.com")) {
        const pathSegs = parsedUrl.pathname.split("/").filter(Boolean);
        if (pathSegs.length > 0 && !["proddetail.html", "dir"].includes(pathSegs[0])) {
          const slug = pathSegs[0].replace(/[^a-z0-9]/gi, "").toLowerCase();
          if (slug) emails.add(`${slug}@indiamart.com`);
        }
      }
    } catch {}
  }

  const address = addressFromJsonLd(org?.address) ?? parseAddressFromText(description) ?? parseAddressFromText(parsed.textSample) ?? parseAddressFromText(parsed.rawHtml);

  return {
    source,
    sourceUrl: url,
    name,
    description,
    businessType: extractBusinessType(parsed.title, parsed.textSample + " " + (parsed.rawHtml ?? "")),
    phone: [...phones],
    email: [...emails],
    address,
    website: org?.url,
    logoUrl: extractLogoUrl(org, parsed.rawHtml, url),
    gstNumber: extractGstNumber(parsed.textSample, parsed.rawHtml),
    yearOfEst: extractYearOfEst(parsed.textSample + " " + (parsed.rawHtml ?? "")),
    trustSeal: checkTrustSeal(parsed, url),
    scrapedAt: new Date(),
    updatedAt: new Date(),
  };
}
