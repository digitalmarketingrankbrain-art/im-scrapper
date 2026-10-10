import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ProductModel } from "@/lib/db/models/Product";
import { logEvent } from "@/lib/logger";
import { hasHealthyAlternative, nextProxy, reportProxyFailure } from "@/scraper/proxy/pool";
import { safeFetch } from "@/scraper/security/safeFetch";
import { limitImages } from "@/scraper/extract/product";
import type { ImageRef } from "@/types";
import { sellerImageDir, slugify } from "./paths";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 20_000;
const ATTEMPTS = 3;
/** The image CDN is a different host from the storefront, so it tolerates more parallelism than page crawling. */
const DEFAULT_CONCURRENCY = 6;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/bmp": "bmp",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ImageDownloadProgress {
  total: number;
  downloaded: number;
  failed: number;
}

export interface ImageDownloadResult extends ImageDownloadProgress {
  failures: { url: string; product: string; error: string }[];
  directory: string;
}

interface Task {
  productId: string;
  productName: string;
  /** Position of this image within its product's `images` array. */
  imageIndex: number;
  /** Absolute http(s) URL. */
  url: string;
  dir: string;
  /** 1-based, zero-padded file prefix so files sort in the product's own image order. */
  prefix: string;
}

type Outcome = { ok: true; localPath: string; bytes: number } | { ok: false; error: string };

/** Image URLs on storefront pages are often protocol-relative (`//5.imimg.com/...`) or relative — resolve them against the page they came from. */
function resolveImageUrl(raw: string, base: string): string | null {
  try {
    const u = new URL(raw.trim(), base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    // Site chrome, not product photos: SVG icon sprites, logos and the storefront's own bundled assets.
    if (/\.svg$/i.test(u.pathname) || /sprite|\/dist\/|favicon/i.test(u.pathname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

async function findExisting(dir: string, hash: string): Promise<string | null> {
  const files = await readdir(dir).catch(() => [] as string[]);
  return files.find((f) => f.includes(`-${hash}.`)) ?? null;
}

/** IndiaMart serves listing thumbnails as `name-250x250.jpg`; the same path with `-1000x1000` is the full-size photo. */
function largerVariant(url: string): string | null {
  const large = url.replace(/-(\d{2,4})x(\d{2,4})(\.[a-z0-9]+)(\?.*)?$/i, "-1000x1000$3$4");
  return large === url ? null : large;
}

async function downloadOne(task: Task): Promise<Outcome> {
  // The hash is of the URL as scraped, so re-runs find the file no matter which size variant was saved.
  const hash = createHash("sha1").update(task.url).digest("hex").slice(0, 8);

  // Re-runs (job retry, re-scrape) must not re-download what is already on disk.
  const existing = await findExisting(task.dir, hash);
  if (existing) return { ok: true, localPath: path.join(task.dir, existing), bytes: 0 };

  // Full-size first; if that variant does not exist for this image, fall back to the scraped URL.
  const large = largerVariant(task.url);
  if (large) {
    const outcome = await fetchAndSave(large, task, hash);
    if (outcome.ok) return outcome;
  }
  return fetchAndSave(task.url, task, hash);
}

async function fetchAndSave(url: string, task: Task, hash: string): Promise<Outcome> {
  let lastError = "unknown error";
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const proxy = nextProxy();
    try {
      const res = await safeFetch(url, {
        proxyUrl: proxy?.url,
        signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          Referer: "https://www.indiamart.com/",
        },
      });

      if (res.status === 429 || res.status >= 500) {
        reportProxyFailure(proxy);
        lastError = `HTTP ${res.status}`;
        await sleep(hasHealthyAlternative(proxy) ? 200 : 1000 * 2 ** attempt);
        continue;
      }
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }; // 404/403: another try won't change it

      const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      const ext = EXTENSIONS[contentType];
      if (!ext) return { ok: false, error: `Not a downloadable image (${contentType || "no content-type"})` };

      const declared = Number(res.headers.get("content-length") ?? 0);
      if (declared > MAX_IMAGE_BYTES) return { ok: false, error: `Too large (${declared} bytes)` };

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0) {
        lastError = "empty response";
        continue;
      }
      if (buffer.length > MAX_IMAGE_BYTES) return { ok: false, error: `Too large (${buffer.length} bytes)` };

      await mkdir(task.dir, { recursive: true });
      const file = path.join(task.dir, `${task.prefix}-${hash}.${ext}`);
      await writeFile(file, buffer);
      return { ok: true, localPath: file, bytes: buffer.length };
    } catch (error) {
      reportProxyFailure(proxy);
      lastError = error instanceof Error ? error.message : String(error);
      await sleep(500 * 2 ** attempt);
    }
  }
  return { ok: false, error: lastError };
}

/** Runs `worker` over `items` with at most `limit` in flight. */
async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        await worker(item);
      }
    }),
  );
}

/**
 * Downloads every image of every product saved for a seller into
 * `downloads/images/<seller>/<product>/NN-<hash>.<ext>` and records the file path on the
 * product's image entry (`localPath`). Failed images get a second pass after a short pause.
 */
export async function downloadProductImages(params: {
  sellerId: string;
  sellerName: string;
  concurrency?: number;
  onProgress?: (progress: ImageDownloadProgress, note?: string) => void | Promise<void>;
}): Promise<ImageDownloadResult> {
  const { sellerId, sellerName, onProgress } = params;
  const root = sellerImageDir(sellerName, sellerId);

  const products = await ProductModel.find({ sellerId }).select("name sourceUrl images").lean();

  const tasks: Task[] = [];
  const imagesByProduct = new Map<string, ImageRef[]>();
  const usedFolders = new Set<string>();

  for (const product of products) {
    const id = String(product._id);
    // Products saved before the cap existed can carry dozens of images — only the first few are the product's own.
    const images = limitImages((product.images ?? []) as ImageRef[]).map((img) => ({ ...img }));
    imagesByProduct.set(id, images);

    // Two products can slugify to the same folder name — keep them apart.
    let folder = slugify(product.name);
    if (usedFolders.has(folder)) folder = `${folder}-${id.slice(-4)}`;
    usedFolders.add(folder);
    const dir = path.join(root, folder);

    const seen = new Set<string>();
    images.forEach((img, imageIndex) => {
      const url = resolveImageUrl(img.url, product.sourceUrl);
      if (!url || seen.has(url)) return;
      seen.add(url);
      tasks.push({
        productId: id,
        productName: product.name,
        imageIndex,
        url,
        dir,
        prefix: String(seen.size).padStart(2, "0"),
      });
    });
  }

  const progress: ImageDownloadProgress = { total: tasks.length, downloaded: 0, failed: 0 };
  await onProgress?.({ ...progress }, tasks.length ? `Downloading ${tasks.length} images…` : "No images to download");

  const outcomes = new Map<Task, Outcome>();
  const concurrency = params.concurrency ?? DEFAULT_CONCURRENCY;

  const runPass = async (list: Task[], limit: number) => {
    await runPool(list, limit, async (task) => {
      const outcome = await downloadOne(task);
      outcomes.set(task, outcome);
      if (outcome.ok) progress.downloaded++;
      else progress.failed++;
      await onProgress?.(
        { ...progress },
        outcome.ok ? undefined : `Image failed (${task.productName}): ${outcome.error}`,
      );
    });
  };

  await runPass(tasks, concurrency);

  // Second chance for failures — a CDN rate limit or blip usually clears within seconds.
  const failedTasks = tasks.filter((t) => outcomes.get(t)?.ok === false);
  if (failedTasks.length > 0) {
    await onProgress?.({ ...progress }, `Retrying ${failedTasks.length} failed image${failedTasks.length > 1 ? "s" : ""}…`);
    await sleep(3000);
    progress.failed -= failedTasks.length;
    await runPass(failedTasks, Math.min(2, concurrency));
  }

  // Write the local file paths back onto each product.
  for (const task of tasks) {
    const outcome = outcomes.get(task);
    const images = imagesByProduct.get(task.productId);
    if (!images || !outcome) continue;
    images[task.imageIndex] = outcome.ok
      ? { ...images[task.imageIndex], localPath: outcome.localPath, downloadError: undefined }
      : { ...images[task.imageIndex], downloadError: outcome.error };
  }
  for (const [productId, images] of imagesByProduct) {
    await ProductModel.updateOne({ _id: productId }, { $set: { images } });
  }

  const failures = tasks.flatMap((t) => {
    const outcome = outcomes.get(t);
    return outcome && !outcome.ok ? [{ url: t.url, product: t.productName, error: outcome.error }] : [];
  });
  logEvent({
    event: "IMAGES_DOWNLOADED",
    status: "done",
    total: progress.total,
    downloaded: progress.downloaded,
    failed: progress.failed,
    directory: root,
  });

  return { ...progress, failures, directory: root };
}
