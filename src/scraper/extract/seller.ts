import * as cheerio from "cheerio";
import type { ScrapeSource, Seller } from "@/types";
import { addressFromJsonLd } from "../normalize/address";
import type { ParsedPage } from "../static/parseHtml";

interface JsonLdOrganization {
  "@type"?: string | string[];
  name?: string;
  description?: string;
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

  const address = addressFromJsonLd(org?.address) ?? parseAddressFromText(description) ?? parseAddressFromText(parsed.textSample) ?? parseAddressFromText(parsed.rawHtml);

  return {
    source,
    sourceUrl: url,
    name,
    description,
    businessType: extractBusinessType(parsed.title, parsed.textSample + " " + (parsed.rawHtml ?? "")),
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

type Row = { TITLE?: string; DATA?: unknown };

/** Fields of a seller block that identify a person or a way to reach them — never collected. */
const CONTACT_FIELD_RE = /phone|mobile|contact|e-?mail|fax|whats ?app|ceo|owner|partner name|director|proprietor name|telephone/i;

export interface DetailSeller {
  seller: Partial<Seller>;
  /** The seller's storefront root (`https://www.indiamart.com/<store>/`), the identity shared by every product of that seller. */
  storeUrl?: string;
}

/** `https://www.indiamart.com/sar-home-projects/products.html` -> `https://www.indiamart.com/sar-home-projects/`. */
export function storeRootUrl(raw: string | undefined, base = "https://www.indiamart.com/"): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw, base);
    if (!/(^|\.)indiamart\.com$/i.test(u.hostname)) return undefined;
    const slug = u.pathname.split("/").filter(Boolean)[0];
    if (!slug || /\.html?$/i.test(slug) || ["proddetail", "impcat", "dir", "search.mp"].includes(slug.toLowerCase())) return undefined;
    return `https://www.indiamart.com/${slug}/`;
  } catch {
    return undefined;
  }
}

function rowsOf(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function text(value: unknown): string | undefined {
  if (value === null || value === undefined || Array.isArray(value) || typeof value === "object") return undefined;
  const t = String(value).replace(/\s+/g, " ").trim();
  return t && !/^(na|n\/a|-|null|undefined)$/i.test(t) ? t : undefined;
}

function camel(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ""))
    .replace(/^./, (c) => c.toLowerCase());
}

/**
 * Seller block of a product detail page (`__NEXT_DATA__` serviceRes.Data[0]) — the "About <seller>" section.
 * Only fields the page actually fills in are returned; contact numbers, e-mail and people's names are skipped.
 */
export function extractSellerFromDetail(parsed: ParsedPage, pageUrl: string, source: ScrapeSource): DetailSeller | undefined {
  const root = (parsed.nextData as { props?: { pageProps?: { serviceRes?: { Data?: unknown } } } } | undefined)?.props?.pageProps?.serviceRes?.Data;
  const d = Array.isArray(root) ? (root[0] as Record<string, unknown> | undefined) : undefined;
  const name = text(d?.COMPANYNAME);
  if (!d || !name) return undefined;

  const storeUrl = storeRootUrl(text(d.URL), pageUrl);

  const statutory = new Map(rowsOf(d.Statutory_Profile).map((r) => [String(r.TITLE ?? "").trim().toLowerCase(), text(r.DATA)]));
  const basic = rowsOf(d.Basic_Information)
    .map((r) => ({ title: String(r.TITLE ?? "").trim(), value: text(r.DATA) }))
    .filter((r) => r.title && r.value && !CONTACT_FIELD_RE.test(r.title));
  const basicValue = (re: RegExp) => basic.find((r) => re.test(r.title))?.value;

  // Everything else the seller block shows (GST registration year / legal status / nature of business...), kept by label.
  const handled = /^(legal status of firm|year of establishment|total number of employees|annual turnover|nature of business)$/i;
  const extra: Record<string, unknown> = {};
  for (const row of basic) if (!handled.test(row.title)) extra[camel(row.title)] = row.value;

  const memberSince = text(d.GLUSR_USR_MEMBERSINCE);
  if (memberSince) extra.memberSince = memberSince.slice(0, 10);
  const rating = text(d.SELLER_RATING);
  if (rating) extra.rating = Number(rating) || rating;
  const ratingCount = (d.SELLER_RATING_COUNTS as { total_count?: number } | undefined)?.total_count;
  if (ratingCount) extra.ratingCount = ratingCount;
  if (d.GST_VERIFIED === 1 || d.GST_VERIFIED_FLAG === 1) extra.gstVerified = true;

  const city = text(d.CITY) ?? text(d.SHORT_ADDRESS);
  const rawAddress = text(d.LONG_ADDRESS) ?? text(d.ADDRESS) ?? city;
  const parts = rawAddress?.split(",").map((p) => p.trim()).filter(Boolean) ?? [];
  const state = text(d.GLUSR_USR_STATE) ?? (parts.length > 1 && parts[parts.length - 1] !== city ? parts[parts.length - 1] : undefined);
  const address = rawAddress ? { raw: rawAddress, city, state, postalCode: text(d.GLUSR_USR_ZIP), country: text(d.GLUSR_USR_COUNTRYNAME) } : undefined;

  const logo = text(d.GLUSR_USR_LOGO_IMG);
  const seller: Partial<Seller> = {
    source,
    sourceUrl: storeUrl ?? `indiamart-seller:${statutory.get("gst no.") ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    description: text(d.GLUSR_USR_DESC),
    businessType: text(d.GLUSR_USR_BIZ_TYPE) ?? basicValue(/^nature of business$/i),
    address,
    logoUrl: logo ? new URL(logo, pageUrl).toString() : undefined,
    gstNumber: statutory.get("gst no."),
    yearOfEst: text(d.GLUSR_USR_YEAR_OF_ESTB) ?? basicValue(/^year of establishment$/i)?.match(/(19|20)\d\d/)?.[0],
    legalStatus: text(d.GL_LEGAL_STATUS_VAL) ?? basicValue(/^legal status of firm$/i),
    numberOfEmployees: text(d.GLUSR_NOOF_EMP_VAL) ?? basicValue(/^total number of employees$/i),
    annualTurnover: text(d.GL_TURNOVER_VAL) ?? basicValue(/^annual turnover$/i),
    metadata: Object.keys(extra).length > 0 ? extra : undefined,
    scrapedAt: new Date(),
    updatedAt: new Date(),
  };
  return { seller, storeUrl };
}

/** Fills only the gaps in `seller` from the seller's own About Us page (the factsheet); existing values win. */
export function mergeStorePage(seller: Partial<Seller>, aboutHtml: string | undefined): Partial<Seller> {
  if (!aboutHtml) return seller;
  const merged = { ...seller };
  const factsheet = extractFactsheet(aboutHtml);
  const year = extractYearOfEst(aboutHtml);
  if (year && !factsheet.yearOfEst) factsheet.yearOfEst = year;
  for (const [key, value] of Object.entries(factsheet)) {
    if (value && !merged[key as keyof Factsheet]) Object.assign(merged, { [key]: value });
  }
  return merged;
}
