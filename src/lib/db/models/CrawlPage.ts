import { model, models, Schema } from "mongoose";

const crawlPageSchema = new Schema({
  jobId: { type: Schema.Types.ObjectId, ref: "ScrapeJob", required: true },
  url: { type: String, required: true },
  status: { type: String, enum: ["queued", "processing", "success", "failed", "skipped"], required: true },
  httpStatus: Number,
  depth: { type: Number, required: true },
  pageType: String,
  error: String,
  discoveredAt: { type: Date, required: true },
  processedAt: Date,
});

crawlPageSchema.index({ jobId: 1, url: 1 }, { unique: true });

export const CrawlPageModel = models.CrawlPage || model("CrawlPage", crawlPageSchema);
