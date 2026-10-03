import { deleteModel, model, models, Schema } from "mongoose";

const scrapeErrorSchema = new Schema(
  {
    url: String,
    type: { type: String, required: true },
    message: { type: String, required: true },
    occurredAt: { type: Date, required: true },
  },
  { _id: false },
);

const activitySchema = new Schema(
  {
    at: { type: Date, required: true },
    message: { type: String, required: true },
    level: { type: String, enum: ["info", "success", "warn", "error"], default: "info" },
  },
  { _id: false },
);

const scrapeJobSchema = new Schema(
  {
    sourceUrl: { type: String, required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "Seller" },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed", "cancelled"],
      default: "pending",
    },
    phase: { type: String, enum: ["discovering", "scraping", "verifying", "downloading", "done"] },
    progress: { type: Number, default: 0 },
    pagesDiscovered: { type: Number, default: 0 },
    pagesProcessed: { type: Number, default: 0 },
    pagesRecovered: { type: Number, default: 0 },
    pagesFailed: { type: Number, default: 0 },
    retryRound: { type: Number, default: 0 },
    productsFound: { type: Number, default: 0 },
    productsProcessed: { type: Number, default: 0 },
    productsMissing: { type: Number, default: 0 },
    imagesTotal: { type: Number, default: 0 },
    imagesDownloaded: { type: Number, default: 0 },
    imagesFailed: { type: Number, default: 0 },
    errors: [scrapeErrorSchema],
    // Live "what is it doing right now" feed — lets the UI show a stuck job apart from a busy one.
    currentAction: String,
    waitingUntil: Date,
    lastActivityAt: Date,
    activity: [activitySchema],
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true, suppressReservedKeysWarning: true },
);

// In dev, hot reload keeps the first-registered model alive, so schema edits (new enum values, new fields)
// were silently ignored until a full restart. Re-register on every load outside production.
if (process.env.NODE_ENV !== "production" && models.ScrapeJob) deleteModel("ScrapeJob");
export const ScrapeJobModel = models.ScrapeJob || model("ScrapeJob", scrapeJobSchema);
