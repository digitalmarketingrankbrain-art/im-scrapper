import { dbConnect } from "@/lib/db/connect";
import { ScrapeJobModel } from "@/lib/db/models/ScrapeJob";
import { logger } from "@/lib/logger";
import { createScrapeWorker } from "@/lib/queue/worker";

/**
 * Jobs still marked "running" when the worker boots belong to a worker that died (restart, crash,
 * tsx-watch reload). Nothing will ever finish them, so they are failed visibly and can be retried
 * from the UI instead of sitting at "running" forever.
 */
async function failOrphanedJobs() {
  await dbConnect();
  const orphans = await ScrapeJobModel.find({ status: "running" });
  for (const job of orphans) {
    job.status = "failed";
    job.phase = "done";
    job.currentAction = undefined;
    job.waitingUntil = undefined;
    job.completedAt = new Date();
    job.errors.push({
      type: "unknown_error",
      message: "Worker stopped or restarted while this job was running — use Retry to run it again.",
      occurredAt: new Date(),
    });
    await job.save();
  }
  if (orphans.length) logger.warn({ count: orphans.length }, "Marked orphaned running jobs as failed");
}

failOrphanedJobs()
  .catch((err) => logger.error({ error: String(err) }, "Orphaned-job cleanup failed"))
  .finally(() => {
    const worker = createScrapeWorker();

    worker.on("completed", (job) => logger.info({ jobId: job.id }, "Scrape job completed"));
    worker.on("failed", (job, err) => logger.error({ jobId: job?.id, error: err.message }, "Scrape job failed"));

    logger.info("Scrape worker started, waiting for jobs on the 'scrape' queue...");
  });
