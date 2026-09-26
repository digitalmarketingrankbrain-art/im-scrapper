import { model, models, Schema } from "mongoose";

const scrapeErrorSchema = new Schema(
  {
    url: String,
    type: { type: String, required: true },
    message: { type: String, required: true },
    occurredAt: { type: Date, required: true },
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
    progress: { type: Number, default: 0 },
    pagesDiscovered: { type: Number, default: 0 },
    pagesProcessed: { type: Number, default: 0 },
    productsFound: { type: Number, default: 0 },
    productsProcessed: { type: Number, default: 0 },
    errors: [scrapeErrorSchema],
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true, suppressReservedKeysWarning: true },
);

export const ScrapeJobModel = models.ScrapeJob || model("ScrapeJob", scrapeJobSchema);
