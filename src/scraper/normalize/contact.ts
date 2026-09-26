const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
/** Indian mobile numbers: optional +91, 10 digits starting 6-9 — the common case on IndiaMart listings. */
const PHONE_PATTERN = /(?:\+91[-\s]?)?[6-9]\d{9}\b/g;

export function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_PATTERN) ?? [];
  return [...new Set(matches.map((match) => match.toLowerCase()))];
}

export function normalizePhone(raw: string): string {
  return raw.replace(/^\+91[-\s]?/, "").replace(/[-\s]/g, "");
}

export function extractPhones(text: string): string[] {
  const matches = text.match(PHONE_PATTERN) ?? [];
  return [...new Set(matches.map(normalizePhone))];
}
