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
