import IORedis from "ioredis";
import { env } from "@/lib/config/env";

let connection: IORedis | null = null;

/** BullMQ requires maxRetriesPerRequest: null on the connection it's handed. */
export function getRedisConnection(): IORedis {
  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL is not configured — required for the background job queue (Phase 7)");
  }
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
}
