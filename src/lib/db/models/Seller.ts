import { model, models, Schema } from "mongoose";

const addressSchema = new Schema(
  { raw: String, street: String, city: String, state: String, postalCode: String, country: String },
  { _id: false },
);

const sellerSchema = new Schema(
  {
    source: { type: String, enum: ["indiamart", "seller_website"], required: true },
    sourceUrl: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    businessType: String,
    phone: [String],
    email: [String],
    address: addressSchema,
    website: String,
    categories: [String],
    gstNumber: String,
    yearOfEst: String,
    trustSeal: Boolean,
    metadata: Schema.Types.Mixed,
    scrapedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const SellerModel = models.Seller || model("Seller", sellerSchema);
