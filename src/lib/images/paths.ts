import path from "node:path";

/** Everything downloaded lives under one root so it can be found, gitignored and wiped in one place. */
export const IMAGES_ROOT = path.join(process.cwd(), "downloads", "images");

export function slugify(input: string, maxLength = 60): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "unnamed";
}

/** `<seller-name>-<last 6 of id>` — the id suffix keeps two sellers with the same name apart. */
export function sellerImageDir(sellerName: string, sellerId: string): string {
  return path.join(IMAGES_ROOT, `${slugify(sellerName)}-${sellerId.slice(-6)}`);
}
