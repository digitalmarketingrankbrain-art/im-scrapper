import { lookup } from "node:dns/promises";
import { isPrivateAddress } from "./ipRanges";

/**
 * Fast preflight check for a clear rejection message (e.g. at job-creation time).
 * This alone does NOT protect fetch/render calls against redirects or DNS rebinding —
 * see safeFetch.ts, which pins every actual connection (including redirect hops) to a
 * freshly-validated address instead of trusting this one-time check.
 */
export async function isSafeUrl(url: string): Promise<boolean> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }

  if (hostname === "localhost") return false;

  try {
    const { address, family } = await lookup(hostname);
    return !isPrivateAddress(address, family);
  } catch {
    return false;
  }
}
