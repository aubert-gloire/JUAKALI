import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICategory extends Document {
  shopId: Types.ObjectId;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    shopId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 50 },
    color: { type: String, default: '#6B7280' },
  },
  { timestamps: true },
);

CategorySchema.index({ shopId: 1, name: 1 }, { unique: true });

export const Category = mongoose.model<ICategory>('Category', CategorySchema);
