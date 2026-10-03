/** A leading =/+/-/@/tab/CR is treated as a formula by Excel/Sheets/LibreOffice — CSV injection (CWE-1236). */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (FORMULA_TRIGGER.test(str)) str = `'${str}`;
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Flat rows only — nested objects (e.g. price) should be pre-flattened by the caller. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvValue(row[header])).join(","));
  }
  return lines.join("\n");
}

export function formatProductRow(
  product: Record<string, unknown>,
  seller: Record<string, unknown> | null,
): Record<string, unknown> {
  const images = (product.images as { url: string }[] | undefined) || [];
  const mainImage = images.length > 0 ? images[0].url : "";
  const allImages = images.map((i) => i.url).join(" | ");

  const specs = product.specifications as Record<string, string> | undefined;
  let specsText = "";
  if (specs && typeof specs === "object") {
    specsText = Object.entries(specs)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");
  }

  const emails = seller?.email ? (Array.isArray(seller.email) ? seller.email.join(" / ") : String(seller.email)) : "";

  const price = product.price as { raw?: string; value?: number; currency?: string; unit?: string } | undefined;
  let priceStr = price?.raw || "";
  if (!priceStr && price?.value) {
    priceStr = `${price.currency || "₹"}${price.value}${price.unit ? " / " + price.unit : ""}`;
  }

  const brand = String(product.brand || seller?.name || "");
  const model = String(
    product.model ||
      (specs ? specs["Battery Cell Model"] || specs["Model"] || specs["Model Name"] || specs["Part Number"] || "" : "")
  );
  const category = String(product.category || (specs ? specs["Category"] || specs["Product Type"] || "" : ""));
  const subCategory = String(product.subCategory || (specs ? specs["Application"] || specs["Battery Type"] || "" : ""));
  const moq = String(product.minimumOrderQuantity || (price?.unit ? `1 ${price.unit}` : "1 Piece"));
  const addressObj = seller?.address as { raw?: string } | undefined;

  return {
    "Product Name": product.name ?? "",
    "Price": priceStr,
    "Price Value": price?.value ?? "",
    "Currency": price?.currency ?? "",
    "MOQ / Unit": moq,
    "Category": category,
    "Sub Category": subCategory,
    "Brand": brand,
    "Model": model,
    "Description": product.description ?? "",
    "Specifications": specsText,
    "Main Image URL": mainImage,
    "All Image URLs": allImages,
    "Seller Name": seller?.name ?? "",
    "Seller Email": emails,
    "Seller GST": seller?.gstNumber ?? "",
    "Seller Address": addressObj?.raw ?? "",
    "Seller Business Type": seller?.businessType ?? "",
    "Seller TrustSEAL": seller?.trustSeal ? "Verified" : "Unverified",
    "Product URL": product.sourceUrl ?? "",
  };
}
