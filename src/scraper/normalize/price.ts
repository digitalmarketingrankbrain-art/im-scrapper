import type { Money } from "@/types";

const CURRENCY_SYMBOLS: Record<string, string> = {
  "₹": "INR",
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  rs: "INR",
  "rs.": "INR",
};

/** Best-effort parse of a price string like "₹ 1,250 / Piece" or "Rs 1,250 / Piece" into a structured Money value. */
export function parseMoney(raw: string): Money {
  const trimmed = raw.trim();

  const currencyMatch = trimmed.match(/[₹$€£]|INR|USD|EUR|GBP|Rs\.?/i);
  const currency = currencyMatch ? (CURRENCY_SYMBOLS[currencyMatch[0].toLowerCase()] ?? currencyMatch[0].toUpperCase()) : null;

  const numberMatch = trimmed.match(/[\d,]+(\.\d+)?/);
  const parsedValue = numberMatch ? Number(numberMatch[0].replace(/,/g, "")) : NaN;
  const value = Number.isNaN(parsedValue) ? null : parsedValue;

  const unitMatch = trimmed.match(/\/\s*([a-zA-Z ]+)$/);
  const unit = unitMatch ? unitMatch[1].trim() : null;

  return { raw: trimmed, value, currency, unit };
}
