import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildEb2bmartRecord, EB2BMART_COLUMNS, toEb2bmartXlsx } from "./eb2bmart";
import { buildXlsx } from "./xlsx";

/** Reads one entry out of a zip by walking the central directory. */
function readEntry(zip: Buffer, name: string): string {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let pos = zip.readUInt32LE(end + 16);
  for (let i = 0; i < zip.readUInt16LE(end + 10); i++) {
    const size = zip.readUInt32LE(pos + 20);
    const nameLen = zip.readUInt16LE(pos + 28);
    const local = zip.readUInt32LE(pos + 42);
    const entry = zip.toString("utf8", pos + 46, pos + 46 + nameLen);
    if (entry === name) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      return inflateRawSync(zip.subarray(start, start + size)).toString("utf8");
    }
    pos += 46 + nameLen + zip.readUInt16LE(pos + 30) + zip.readUInt16LE(pos + 32);
  }
  throw new Error(`no entry ${name}`);
}

describe("xlsx export", () => {
  it("writes a zip with the parts Excel needs", () => {
    const zip = buildXlsx("Products", ["a", "b"], [["x & <y>", "+91-1"]]);
    expect(zip.subarray(0, 2).toString()).toBe("PK");
    expect(readEntry(zip, "xl/workbook.xml")).toContain('name="Products"');
    const sheet = readEntry(zip, "xl/worksheets/sheet1.xml");
    expect(sheet).toContain("x &amp; &lt;y&gt;");
    expect(sheet).toContain("+91-1");
  });

  it("matches the reference sheet: 25 columns incl. seller, specifications as JSON", () => {
    const record = buildEb2bmartRecord(
      { name: "Gate", specifications: { Material: "Mild Steel" }, price: { value: 350, currency: "INR" } },
      { name: "Acme", gstNumber: "09FVDPK2630B1ZY" },
    );
    const sheet = readEntry(toEb2bmartXlsx([record]), "xl/worksheets/sheet1.xml");
    for (const column of EB2BMART_COLUMNS) expect(sheet).toContain(`>${column}<`);
    expect(sheet).toContain('{"material":"Mild Steel"}');
    expect(sheet).toContain("09FVDPK2630B1ZY");
  });
});
