import { describe, expect, it } from "vitest";
import { parseHtml } from "../static/parseHtml";
import { extractFactsheet, extractSeller } from "./seller";
import { extractProduct } from "./product";

describe("Seller & Product Data Extraction", () => {
  describe("extractSeller", () => {
    it("should extract seller details from JSON-LD Organization", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Acme Industrial Supplies - IndiaMart Seller</title>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Acme Industrial Pvt Ltd",
            "description": "Leading manufacturer of industrial tools and machinery",
            "telephone": "+91 9876543210",
            "email": "sales@acmeind.com",
            "url": "https://www.acmeind.com",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Plot No 42, GIDC Industrial Area",
              "addressLocality": "Ahmedabad",
              "addressRegion": "Gujarat",
              "postalCode": "380015",
              "addressCountry": "India"
            }
          }
          </script>
        </head>
        <body>
          Contact us at +91 9876543210 or email info@acmeind.com
        </body>
        </html>
      `;

      const parsed = parseHtml(html, "https://acme.indiamart.com");
      const seller = extractSeller(parsed, "https://acme.indiamart.com", "indiamart");

      expect(seller.name).toBe("Acme Industrial Pvt Ltd");
      expect(seller.description).toBe("Leading manufacturer of industrial tools and machinery");
      expect(seller.phone).toEqual(["9876543210"]);
      expect(seller.email).toContain("sales@acmeind.com");
      expect(seller.email).toContain("info@acmeind.com");
      expect(seller.website).toBe("https://www.acmeind.com");
      expect(seller.address).toEqual({
        raw: "Plot No 42, GIDC Industrial Area, Ahmedabad, Gujarat, 380015, India",
        street: "Plot No 42, GIDC Industrial Area",
        city: "Ahmedabad",
        state: "Gujarat",
        postalCode: "380015",
        country: "India",
      });
    });

    it("extracts logo and tel: phones, ignores IndiaMART's own logo and bare 10-digit ids", () => {
      const html = `<html><head><title>X</title></head><body>
        <img alt="im Logo" src="https://hm.imimg.com/template-mdc/imLogo1.png">
        <img class="company-logo" src="//5.imimg.com/data5/SELLER/Default/logo.png">
        <a href="tel:+91-9812345678">Call</a>
        <span>Product id 7123456789</span></body></html>`;
      const seller = extractSeller(parseHtml(html, "https://www.indiamart.com/x/"), "https://www.indiamart.com/x/", "indiamart");
      expect(seller.logoUrl).toBe("https://5.imimg.com/data5/SELLER/Default/logo.png");
      expect(seller.phone).toEqual(["9812345678"]);
    });

    it("reads GST No. from the About Us factsheet", () => {
      const html = `<div class="factsheet-table__row"><dt class="factsheet-table__label">GST No.</dt><dd class="factsheet-table__value">37HXXPP0646E1ZU</dd></div>
        <div class="factsheet-table__row"><dt class="factsheet-table__label">Legal Status of Firm</dt><dd class="factsheet-table__value">Proprietorship</dd></div>`;
      expect(extractFactsheet(html)).toEqual({ gstNumber: "37HXXPP0646E1ZU", legalStatus: "Proprietorship" });
    });

    it("should fallback to meta tags and title when JSON-LD is missing", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Global Tech Traders</title>
          <meta name="og:site_name" content="Global Tech Traders" />
          <meta name="description" content="Exporter of electronic items" />
        </head>
        <body>
          Call our office: +91-9123456789
        </body>
        </html>
      `;

      const parsed = parseHtml(html, "https://globaltech.indiamart.com");
      const seller = extractSeller(parsed, "https://globaltech.indiamart.com", "indiamart");

      expect(seller.name).toBe("Global Tech Traders");
      expect(seller.description).toBe("Exporter of electronic items");
      expect(seller.phone).toEqual([]);
    });
  });

  describe("extractProduct", () => {
    it("should extract product details from JSON-LD and __NEXT_DATA__", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Automatic CNC Milling Machine - IndiaMart</title>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Automatic CNC Milling Machine",
            "description": "High precision 3-axis CNC milling machine for metal work",
            "brand": { "name": "PrecisionTech" },
            "image": ["https://img.indiamart.com/cnc-machine-1.jpg"],
            "offers": {
              "@type": "Offer",
              "price": "Rs 4,50,000 / Piece",
              "priceCurrency": "INR"
            }
          }
          </script>
          <script id="__NEXT_DATA__" type="application/json">
          {
            "props": {
              "pageProps": {
                "serviceRes": {
                  "Data": [
                    {
                      "PARENT_MCAT": { "GLCAT_MCAT_NAME": "CNC Machinery" },
                      "BRD_MCAT_NAME": "Milling Machines",
                      "PC_ITEM_MIN_ORDER_QUANTITY": "1",
                      "PC_ITEM_MOQ_UNIT_TYPE": "Set",
                      "ISQ": [
                        { "FK_IM_SPEC_MASTER_DESC": "Automation Grade", "SUPPLIER_RESPONSE_DETAIL": "Automatic" },
                        { "FK_IM_SPEC_MASTER_DESC": "Spindle Speed", "SUPPLIER_RESPONSE_DETAIL": "8000 RPM" },
                        { "FK_IM_SPEC_MASTER_DESC": "Voltage", "SUPPLIER_RESPONSE_DETAIL": "415 V" }
                      ]
                    }
                  ]
                }
              }
            }
          }
          </script>
        </head>
        <body></body>
        </html>
      `;

      const parsed = parseHtml(html, "https://www.indiamart.com/proddetail/cnc-milling-machine.html");
      const product = extractProduct(parsed, "https://www.indiamart.com/proddetail/cnc-milling-machine.html", "indiamart");

      expect(product.name).toBe("Automatic CNC Milling Machine");
      expect(product.description).toBe("High precision 3-axis CNC milling machine for metal work");
      expect(product.brand).toBe("PrecisionTech");
      expect(product.category).toBe("CNC Machinery");
      expect(product.price).toEqual({
        raw: "Rs 4,50,000 / Piece",
        value: 450000,
        currency: "INR",
        unit: "Piece",
      });
      expect(product.minimumOrderQuantity).toBe("1 Set");
      expect(product.specifications).toEqual({
        "Automation Grade": "Automatic",
        "Spindle Speed": "8000 RPM",
        "Voltage": "415 V",
      });
      expect(product.images).toEqual([
        { url: "https://img.indiamart.com/cnc-machine-1.jpg", source: "json-ld" }
      ]);
    });

    it("should handle product without __NEXT_DATA__ gracefully", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Stainless Steel Bolts</title>
          <script type="application/ld+json">
          {
            "@type": "Product",
            "name": "SS Hex Bolt",
            "description": "Grade 304 Hex Bolt",
            "brand": "FastenerCorp",
            "offers": { "price": "15" }
          }
          </script>
        </head>
        <body></body>
        </html>
      `;

      const parsed = parseHtml(html, "https://www.indiamart.com/proddetail/ss-hex-bolt.html");
      const product = extractProduct(parsed, "https://www.indiamart.com/proddetail/ss-hex-bolt.html", "indiamart");

      expect(product.name).toBe("SS Hex Bolt");
      expect(product.brand).toBe("FastenerCorp");
      expect(product.price).toEqual({
        raw: "15",
        value: 15,
        currency: null,
        unit: null,
      });
      expect(product.specifications).toBeUndefined();
      expect(product.minimumOrderQuantity).toBeUndefined();
    });
  });
});
