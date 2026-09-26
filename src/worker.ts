import { logger } from "@/lib/logger";
import { createScrapeWorker } from "@/lib/queue/worker";

const worker = createScrapeWorker();

worker.on("completed", (job) => logger.info({ jobId: job.id }, "Scrape job completed"));
worker.on("failed", (job, err) => logger.error({ jobId: job?.id, error: err.message }, "Scrape job failed"));

logger.info("Scrape worker started, waiting for jobs on the 'scrape' queue...");
