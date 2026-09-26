import pino from "pino";
import { env } from "@/lib/config/env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true } },
});

export interface ScrapeLogEvent {
  event: string;
  jobId?: string;
  url?: string;
  status?: string;
  duration?: number;
  error?: string;
  [key: string]: unknown;
}

export function logEvent(entry: ScrapeLogEvent) {
  logger.info(entry, entry.event);
}
