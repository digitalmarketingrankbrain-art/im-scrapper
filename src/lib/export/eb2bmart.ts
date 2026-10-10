/**
 * Export in the EB2BMART / Aajjo upload format — the shape the target platform already ingests
 * (see Aajjo Scraper's export.service.ts). Same field names, same nesting, same flat CSV columns
 * and column order, so a file from this scraper can be uploaded exactly like one from Aajjo.
 *
 * Mapping from IndiaMart data is lossy by nature (IndiaMart has no logo URL, employee count, etc.):
 * fields with no source are emitted as empty strings / null, as Aajjo does for its own gaps.
 */

export interface Eb2bmartRecord {
  product_name: string;
  price: { amount: number | null; currency: string };
  priceUnit: string;
  sub_category: string;
  product_type: string;
  seller: {
    name: string;
    address: string;
    state: string;
    country: string;
    contact_details: string;
    logo_url: string;
  };
  company: {
    gst_number: string;
    business_type: string;
    years_established: number | null;
    number_of_employees: string;
    turnover: string;
    legal_status: string;
  };
  images: string[];
  specifications: Record<string, string>;
  description: {
    summary: string;
    key_features: Record<string, string>;
    applications: string;
    benefits: string;
    call_to_action: string;
  };
}

/** Flat CSV columns, in the exact order the Aajjo export writes them. */
export const EB2BMART_COLUMNS = [
  "product_name",
  "price.amount",
  "price.currency",
  "priceUnit",
  "sub_category",
  "product_type",
  "seller.name",
  "seller.address",
  "seller.state",
  "seller.country",
  "seller.contact_details",
  "seller.logo_url",
  "company.gst_number",
  "company.business_type",
  "company.years_established",
  "company.number_of_employees",
  "company.turnover",
  "company.legal_status",
  "images",
  "description.summary",
  "description.applications",
  "description.benefits",
  "description.call_to_action",
  "description.key_features",
  "specifications",
] as const;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

/** Scraped pages sometimes carry double-encoded entities ("40&quot;"); decode so uploaded text reads normally. */
export function decodeEntities(str: string | undefined | null): string {
  if (!str || !str.includes("&")) return str ?? "";
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, ent: string) => {
    if (ent[0] === "#") {
      const code = ent[1] === "x" || ent[1] === "X" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[ent] ?? match;
  });
}

/** Spec keys are snake_case in the upload format ("Battery Voltage" -> "battery_voltage"). */
export function toSnakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Splits a description into the platform's sections when it carries the "Key Features:" /
 * "Applications:" / "Why Choose This Product:" markers; otherwise the whole text is the summary.
 */
export function parseDescription(raw: string | undefined | null): Eb2bmartRecord["description"] {
  const text = decodeEntities(raw).trim();
  if (!text) return { summary: "", key_features: {}, applications: "", benefits: "", call_to_action: "" };

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const findIdx = (label: string) => paragraphs.findIndex((p) => p.toLowerCase().startsWith(label.toLowerCase()));

  const kfIdx = findIdx("Key Features:");
  const appIdx = findIdx("Applications:");
  const whyIdx = findIdx("Why Choose This Product:");

  if (kfIdx === -1 && appIdx === -1 && whyIdx === -1) {
    return { summary: text, key_features: {}, applications: "", benefits: "", call_to_action: "" };
  }

  const stripLabel = (p: string, label: string) => p.slice(label.length).trim();
  const markerIdxs = [kfIdx, appIdx, whyIdx].filter((i) => i >= 0).sort((a, b) => a - b);
  const summary = paragraphs.slice(0, markerIdxs[0]).join("\n\n");

  const key_features: Record<string, string> = {};
  if (kfIdx >= 0) {
    for (const pair of stripLabel(paragraphs[kfIdx], "Key Features:").split(",")) {
      const idx = pair.indexOf(":");
      if (idx === -1) continue;
      const label = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (label) key_features[toSnakeCase(label)] = value;
    }
  }

  return {
    summary,
    key_features,
    applications: appIdx >= 0 ? stripLabel(paragraphs[appIdx], "Applications:") : "",
    benefits: whyIdx >= 0 ? stripLabel(paragraphs[whyIdx], "Why Choose This Product:") : "",
    call_to_action: paragraphs.slice(markerIdxs[markerIdxs.length - 1] + 1).join("\n\n"),
  };
}

type Loose = Record<string, unknown>;

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/** Resolves `//host/x.jpg` and relative URLs against the page they came from. */
function absoluteUrl(raw: string, base: string): string {
  try {
    return new URL(raw.trim(), base).toString();
  } catch {
    return raw.trim();
  }
}

function imageUrls(product: Loose): string[] {
  const images = (product.images as { url?: string; storageUrl?: string }[] | undefined) ?? [];
  const base = str(product.sourceUrl) || "https://www.indiamart.com/";
  const urls: string[] = [];
  for (const img of images) {
    // storageUrl is where the S3 upload step will put the final bucket URL; until then the source URL is used.
    const url = img.storageUrl || (img.url ? absoluteUrl(img.url, base) : "");
    if (url && !/\.svg(\?|#|$)|sprite|\/dist\//i.test(url) && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

/** IndiaMart's category/sub-category map to the platform's sub_category/product_type; they need the platform's own taxonomy mapping later. */
export function buildEb2bmartRecord(product: Loose, seller: Loose | null): Eb2bmartRecord {
  const price = product.price as { value?: number | null; currency?: string | null; unit?: string | null } | undefined;
  const address = (seller?.address as Loose | undefined) ?? {};
  const phones = seller?.phone;
  const yearRaw = Number(seller?.yearOfEst);

  const specifications: Record<string, string> = {};
  const rawSpecs = (product.specifications as Record<string, unknown> | undefined) ?? {};
  for (const [name, value] of Object.entries(rawSpecs)) {
    const key = toSnakeCase(name);
    if (key && value !== null && value !== undefined && value !== "") specifications[key] = decodeEntities(str(value));
  }
  // Aajjo records keep brand / model / moq inside specifications — mirror that so nothing is lost.
  const extras: [string, unknown][] = [
    ["brand", product.brand],
    ["model", product.model],
    ["moq", product.minimumOrderQuantity],
  ];
  for (const [key, value] of extras) {
    if (value && !(key in specifications)) specifications[key] = decodeEntities(str(value));
  }

  // On some storefront pages the category slot holds the seller's own name (the page H1) — that is not a category.
  const sellerName = str(seller?.name).trim().toLowerCase();
  const rawCategory = str(product.category).trim();
  const category = rawCategory.toLowerCase() === sellerName ? "" : rawCategory;
  const subCategory = str(product.subCategory);

  return {
    product_name: decodeEntities(str(product.name)),
    price: { amount: price?.value ?? null, currency: price?.currency || "INR" },
    priceUnit: str(price?.unit),
    sub_category: category,
    product_type: subCategory || category,
    seller: {
      name: decodeEntities(str(seller?.name)),
      address: decodeEntities(str(address.raw)),
      state: str(address.state),
      country: str(address.country) || "India",
      contact_details: Array.isArray(phones) ? phones.join(", ") : str(phones),
      logo_url: "",
    },
    company: {
      gst_number: str(seller?.gstNumber),
      business_type: str(seller?.businessType),
      years_established: Number.isFinite(yearRaw) && yearRaw > 0 ? yearRaw : null,
      number_of_employees: "",
      turnover: "",
      legal_status: "",
    },
    images: imageUrls(product),
    specifications,
    description: parseDescription(str(product.description)),
  };
}

function flatten(value: unknown, prefix: string, out: Record<string, string>): void {
  if (value === null || value === undefined) {
    out[prefix] = "";
  } else if (Array.isArray(value)) {
    out[prefix] = value.join("|");
  } else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out[prefix] = String(value);
  }
}

/** One CSV row: nested fields become dotted columns, images join with "|", specifications/key_features stay as single JSON cells. */
export function toFlatRow(record: Eb2bmartRecord): Record<string, string> {
  const out: Record<string, string> = {};
  flatten(
    {
      ...record,
      specifications: JSON.stringify(record.specifications),
      description: { ...record.description, key_features: JSON.stringify(record.description.key_features) },
    },
    "",
    out,
  );
  const row: Record<string, string> = {};
  for (const column of EB2BMART_COLUMNS) row[column] = out[column] ?? "";
  return row;
}

function csvCell(value: string): string {
  // No formula-guard prefix here on purpose: this file is machine-uploaded, and a leading
  // apostrophe would corrupt values like "+91-..." or "-" prefixed names on import.
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** CSV with the Aajjo header/column order (header row always present, even with zero products). */
export function toEb2bmartCsv(records: Eb2bmartRecord[]): string {
  const lines = [EB2BMART_COLUMNS.join(",")];
  for (const record of records) {
    const row = toFlatRow(record);
    lines.push(EB2BMART_COLUMNS.map((c) => csvCell(row[c])).join(","));
  }
  return lines.join("\n") + "\n";
}

export function toEb2bmartJson(records: Eb2bmartRecord[]): string {
  return JSON.stringify(records, null, 2);
}
