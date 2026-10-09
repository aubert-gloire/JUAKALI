import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICustomer extends Document {
  shopId: Types.ObjectId;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  totalSpent: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    shopId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    notes: { type: String },
    totalSpent: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);
