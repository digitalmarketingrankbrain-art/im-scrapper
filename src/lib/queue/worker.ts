import { Worker } from "bullmq";
import { getRedisConnection } from "./connection";
import { processScrapeJob } from "./processScrapeJob";
import type { ScrapeJobData } from "./scrapeQueue";

export function createScrapeWorker(): Worker<ScrapeJobData> {
  return new Worker<ScrapeJobData>(
    "scrape",
    async (job) => {
      await processScrapeJob(job.data.jobId, job.data.sourceUrl);
    },
    { connection: getRedisConnection(), concurrency: 1 },
  );
}
