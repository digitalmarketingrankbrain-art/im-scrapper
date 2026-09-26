import { NextRequest, NextResponse } from "next/server";
import { scrapePage, type ScrapeMode } from "@/scraper";

const VALID_MODES: ScrapeMode[] = ["static", "dynamic", "auto"];

/**
 * Verification endpoint: GET /api/scrape?url=<target>&mode=static|dynamic|auto (default auto)
 * Will be superseded by the job-based scrape API in later phases.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const modeParam = request.nextUrl.searchParams.get("mode") ?? "auto";

  if (!url) {
    return NextResponse.json({ status: "error", message: "Missing 'url' query parameter" }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid URL" }, { status: 400 });
  }

  if (!VALID_MODES.includes(modeParam as ScrapeMode)) {
    return NextResponse.json(
      { status: "error", message: `Invalid 'mode', expected one of: ${VALID_MODES.join(", ")}` },
      { status: 400 },
    );
  }

  const result = await scrapePage(url, modeParam as ScrapeMode);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
