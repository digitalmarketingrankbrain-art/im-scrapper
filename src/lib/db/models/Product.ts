import { deleteModel, model, models, Schema } from "mongoose";

const moneySchema = new Schema(
  { raw: String, value: Number, currency: String, unit: String },
  { _id: false },
);

const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    alt: String,
    source: { type: String, enum: ["src", "data-src", "srcset", "og", "json-ld", "html"], required: true },
    storageUrl: String,
    localPath: String,
    downloadError: String,
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "Seller", required: true },
    source: { type: String, enum: ["indiamart", "seller_website"], required: true },
    sourceUrl: { type: String, required: true },
    // Identity across scraping modes (IndiaMart product id) — what keeps one product from being saved twice.
    productKey: String,
    jobId: { type: Schema.Types.ObjectId, ref: "ScrapeJob" },
    name: { type: String, required: true },
    description: String,
    category: String,
    subCategory: String,
    productType: String,
    price: moneySchema,
    minimumOrderQuantity: String,
    specifications: Schema.Types.Mixed,
    keyFeatures: Schema.Types.Mixed,
    brand: String,
    model: String,
    images: [imageSchema],
    metadata: Schema.Types.Mixed,
    scrapedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

productSchema.index({ sellerId: 1 });
productSchema.index({ sellerId: 1, name: 1 }, { unique: true });
productSchema.index({ jobId: 1 });
// Partial: products saved before productKey existed have none and must not collide with each other.
productSchema.index({ productKey: 1 }, { unique: true, partialFilterExpression: { productKey: { $type: "string" } } });

// In dev, hot reload keeps the first-registered model alive, so schema edits (new enum values, new fields)
// were silently ignored until a full restart. Re-register on every load outside production.
if (process.env.NODE_ENV !== "production" && models.Product) deleteModel("Product");
export const ProductModel = models.Product || model("Product", productSchema);
