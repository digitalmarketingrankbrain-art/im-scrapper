import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";

export interface ScrapeJobData {
  /** Mongo ScrapeJob _id, as a string */
  jobId: string;
  sourceUrl: string;
  concurrency?: number;
}

let queue: Queue<ScrapeJobData> | null = null;

export function getScrapeQueue(): Queue<ScrapeJobData> {
  if (!queue) {
    queue = new Queue<ScrapeJobData>("scrape", { connection: getRedisConnection() });
  }
  return queue;
}
