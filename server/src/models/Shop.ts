import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IShop extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  name: string;
  location: string;
  phone?: string;
  currency: string;
  timezone: string;
  receiptFooter?: string;
  allowNegativeStock: boolean;
  lowStockDefault: number;
  createdAt: Date;
  updatedAt: Date;
}

const ShopSchema = new Schema<IShop>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    currency: { type: String, default: 'RWF' },
    timezone: { type: String, default: 'Africa/Kigali' },
    receiptFooter: { type: String },
    allowNegativeStock: { type: Boolean, default: false },
    lowStockDefault: { type: Number, default: 5, min: 0 },
  },
  { timestamps: true },
);

ShopSchema.index({ organizationId: 1, name: 1 });

export const Shop = mongoose.model<IShop>('Shop', ShopSchema);
