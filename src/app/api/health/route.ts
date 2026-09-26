import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/connect";
import { logEvent } from "@/lib/logger";

export async function GET() {
  const startedAt = Date.now();

  try {
    await dbConnect();
    const duration = Date.now() - startedAt;
    logEvent({ event: "HEALTH_CHECK", status: "ok", duration });

    return NextResponse.json({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    logEvent({ event: "HEALTH_CHECK", status: "error", duration, error: message });

    return NextResponse.json({ status: "error", db: "disconnected" }, { status: 503 });
  }
}
