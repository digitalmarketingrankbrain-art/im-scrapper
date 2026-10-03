import { chromium, type Browser } from "playwright";

/** Process-wide singleton — launching Chromium per request is expensive. */
let browserPromise: Promise<Browser> | null = null;

export function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const launching = chromium.launch({
      headless: true,
      // /dev/shm is tiny in containers and Chromium tabs die ("Target crashed") when it fills up.
      args: ["--disable-dev-shm-usage", "--disable-gpu"],
    });
    browserPromise = launching;
    launching.then(
      (browser) => {
        // A crashed/killed Chromium would otherwise stay cached and fail every later render.
        browser.on("disconnected", () => {
          if (browserPromise === launching) browserPromise = null;
        });
      },
      () => {
        if (browserPromise === launching) browserPromise = null;
      },
    );
  }
  return browserPromise;
}

/** Drops the cached browser so the next getBrowser() launches a fresh one (used after a crash). */
export async function resetBrowser(): Promise<void> {
  const current = browserPromise;
  browserPromise = null;
  if (!current) return;
  try {
    await (await current).close();
  } catch {
    // Already dead — nothing to close.
  }
}

export async function closeBrowser(): Promise<void> {
  await resetBrowser();
}
