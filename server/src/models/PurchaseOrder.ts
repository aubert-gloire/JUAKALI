import mongoose, { Schema, Document, Types } from 'mongoose';

export type PurchaseStatus = 'draft' | 'ordered' | 'received' | 'partial' | 'cancelled';

export interface IPurchaseOrderLine {
  productId: Types.ObjectId;
  productName: string;
  qty: number;
  unitCost: number;
  totalCost: number;
}

export interface IPurchaseOrder extends Document {
  shopId: Types.ObjectId;
  orderNumber: string;
  supplierId?: Types.ObjectId;
  supplierName?: string;
  status: PurchaseStatus;
  lines: IPurchaseOrderLine[];
  totalCost: number;
  notes?: string;
  receivedAt?: Date;
  receivedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LineSchema = new Schema<IPurchaseOrderLine>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const PurchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    shopId: { type: Schema.Types.ObjectId, required: true, index: true },
    orderNumber: { type: String, required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier' },
    supplierName: { type: String },
    status: {
      type: String,
      enum: ['draft', 'ordered', 'received', 'partial', 'cancelled'],
      default: 'draft',
    },
    lines: [LineSchema],
    totalCost: { type: Number, default: 0 },
    notes: { type: String },
    receivedAt: { type: Date },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

PurchaseOrderSchema.index({ shopId: 1, orderNumber: 1 }, { unique: true });

export const PurchaseOrder = mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
