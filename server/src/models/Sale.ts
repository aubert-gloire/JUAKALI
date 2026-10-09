import mongoose, { Schema, Document, Types } from 'mongoose';

export type PaymentMethod = 'cash' | 'mobile_money' | 'card' | 'credit';
export type SaleStatus = 'completed' | 'voided';

export interface ISaleItem {
  productId: Types.ObjectId;
  productName: string;
  sku: string;
  qty: number;
  unitCost: number;    // cost at time of sale — for profit calc
  unitPrice: number;   // selling price at time of sale
  totalCost: number;
  totalPrice: number;
}

export interface ISale extends Document {
  shopId: Types.ObjectId;
  saleNumber: string;
  items: ISaleItem[];
  subtotal: number;      // sum of item totalPrice
  discountAmount: number;
  total: number;         // subtotal - discountAmount
  totalCost: number;     // sum of item totalCost
  profit: number;        // total - totalCost
  paymentMethod: PaymentMethod;
  amountTendered?: number;
  change?: number;
  customerId?: Types.ObjectId;
  customerName?: string;
  status: SaleStatus;
  voidedAt?: Date;
  voidedBy?: Types.ObjectId;
  voidReason?: string;
  cashierId: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SaleItemSchema = new Schema<ISaleItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const SaleSchema = new Schema<ISale>(
  {
    shopId: { type: Schema.Types.ObjectId, required: true, index: true },
    saleNumber: { type: String, required: true },
    items: [SaleItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    profit: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ['cash', 'mobile_money', 'card', 'credit'],
      required: true,
    },
    amountTendered: { type: Number },
    change: { type: Number },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String },
    status: { type: String, enum: ['completed', 'voided'], default: 'completed' },
    voidedAt: { type: Date },
    voidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    voidReason: { type: String },
    cashierId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String },
  },
  { timestamps: true },
);

SaleSchema.index({ shopId: 1, saleNumber: 1 }, { unique: true });
SaleSchema.index({ shopId: 1, createdAt: -1 });
SaleSchema.index({ shopId: 1, status: 1, createdAt: -1 });

export const Sale = mongoose.model<ISale>('Sale', SaleSchema);
