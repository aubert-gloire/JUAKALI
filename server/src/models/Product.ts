import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProduct extends Document {
  shopId: Types.ObjectId;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  categoryId?: Types.ObjectId;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  stockQty: number;
  reorderLevel: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    shopId: { type: Schema.Types.ObjectId, required: true, index: true },
    sku: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    unit: { type: String, default: 'pcs' },
    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    stockQty: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 5 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

ProductSchema.index({ shopId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ shopId: 1, barcode: 1 }, { sparse: true });
ProductSchema.index({ shopId: 1, name: 'text', description: 'text' });

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
