/** Test helper: builds an IndiaMart-style product detail page (same structure as a real `/proddetail/` page). */
export interface DetailFixtureOptions {
  specs?: [string, string][];
  /** Number of gallery photos (on top of the primary image). */
  galleryImages?: number;
  breadcrumb?: string[] | null;
  company?: string;
  storeUrl?: string | null;
}

export const FIXTURE_PHONE = "+91-8047790754,3611";

const SPEC_NAMES: [string, string][] = [
  ["Needle Count", "12 Needle"],
  ["Max Speed", "1200 spm"],
  ["Voltage", "220 V"],
  ["Brand", "TTM"],
  ["Frequency", "50 Hz"],
];

export function specsOf(count: number): [string, string][] {
  return SPEC_NAMES.slice(0, count);
}

export function detailPageHtml(options: DetailFixtureOptions = {}): string {
  const specs = options.specs ?? specsOf(4);
  const gallery = Array.from({ length: options.galleryImages ?? 2 }, (_, i) => ({
    IMAGE_1000x1000: `https://5.imimg.com/data5/SELLER/Default/2025/11/g${i}/machine-1000x1000.png`,
    IMAGE_ORIGINAL: `https://5.imimg.com/data5/SELLER/Default/2025/11/g${i}/machine.png`,
  }));
  const crumbs = options.breadcrumb === undefined ? ["IndiaMART", "Sewing,Knitting & Embroidery Machine", "Embroidery Machine", "Single Head Embroidery Machine"] : options.breadcrumb;
  const company = options.company ?? "TTM Embroidery";
  const storeUrl = options.storeUrl === undefined ? "https://www.indiamart.com/sar-home-projects/" : options.storeUrl;

  const data = {
    PC_ITEM_NAME: "Embroidery Machine Single Head",
    PC_ITEM_DESC_SMALL: "A single-head embroidery machine.",
    PC_ITEM_DISPLAY_ID: "2857861993873",
    PC_ITEM_IMG_1000x1000: "https://5.imimg.com/data5/SELLER/Default/2025/11/main/machine-1000x1000.png",
    ITEM_IMG: gallery,
    ISQ: specs.map(([name, value]) => ({ FK_IM_SPEC_MASTER_DESC: name, SUPPLIER_RESPONSE_DETAIL: value })),
    FOB_PRICE: "320000",
    FOB_PRICE_CURRENCY: "INR",
    PARENT_MCAT: { GLCAT_MCAT_NAME: "Embroidery Machine" },
    COMPANYNAME: company,
    URL: storeUrl ?? "",
    CITY: "Visakhapatnam",
    LONG_ADDRESS: "Visakhapatnam, Andhra Pradesh",
    GLUSR_USR_COUNTRYNAME: "India",
    GLUSR_USR_DESC: "We trade embroidery machines.",
    GLUSR_USR_MEMBERSINCE: "2023-01-18 07:42:39",
    GL_LEGAL_STATUS_VAL: "Sole Proprietorship (Individual)",
    SELLER_RATING: "3.0",
    GST_VERIFIED: 1,
    // Contact / personal fields the page ships — none of these may reach the result.
    MOBILE_PNS: FIXTURE_PHONE,
    GLUSR_USR_FIRSTNAME: "Tarun",
    Basic_Information: [
      { TITLE: "Company CEO", DATA: "Tarun Kumar" },
      { TITLE: "GST Registration Year", DATA: "2026" },
      { TITLE: "GST Legal Status of Firm", DATA: "Proprietorship" },
      { TITLE: "Nature of Business", DATA: "" },
    ],
    Statutory_Profile: [{ TITLE: "GST No.", DATA: "37HXXPP0646E1ZU" }],
  };

  const breadcrumbLd =
    crumbs === null
      ? ""
      : `<script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: crumbs.map((name, i) => ({ "@type": "ListItem", position: i + 1, item: { "@id": `https://dir.indiamart.com/c${i}`, name } })),
        })}</script>`;

  return `<!DOCTYPE html><html><head><title>Embroidery Machine Single Head</title>
    ${breadcrumbLd}
    <script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org/", "@type": "Product", name: "Embroidery Machine Single Head", description: "A single-head embroidery machine.", image: "https://5.imimg.com/data5/SELLER/Default/2025/11/main/machine-500x500.png", offers: { "@type": "Offer", priceCurrency: "INR", price: "320000" } })}</script>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { serviceRes: { Data: [data] } } } })}</script>
    </head><body>
      <div class="isq-container"><table class="isq-table-ff"><tbody>${specs.map(([k, v]) => `<tr><td class="tdwdt">${k}</td><td class="tdwdt1"><span>${v}</span></td></tr>`).join("")}</tbody></table></div>
      <section class="g39-factsheet"><dl><div><dt>Contact Number</dt><dd>${FIXTURE_PHONE}</dd></div><div><dt>Address</dt><dd>Visakhapatnam, Andhra Pradesh</dd></div></dl></section>
    </body></html>`;
}
