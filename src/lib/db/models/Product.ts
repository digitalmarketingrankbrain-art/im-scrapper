import { model, models, Schema } from "mongoose";

const moneySchema = new Schema(
  { raw: String, value: Number, currency: String, unit: String },
  { _id: false },
);

const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    alt: String,
    source: { type: String, enum: ["src", "data-src", "srcset", "og", "json-ld"], required: true },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "Seller", required: true },
    source: { type: String, enum: ["indiamart", "seller_website"], required: true },
    sourceUrl: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    category: String,
    subCategory: String,
    price: moneySchema,
    minimumOrderQuantity: String,
    specifications: Schema.Types.Mixed,
    brand: String,
    model: String,
    images: [imageSchema],
    metadata: Schema.Types.Mixed,
    scrapedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

productSchema.index({ sellerId: 1 });

export const ProductModel = models.Product || model("Product", productSchema);
