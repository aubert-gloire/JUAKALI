import mongoose, { Schema, Document, Types } from 'mongoose';

export type MovementType = 'purchase' | 'sale' | 'adjustment' | 'return' | 'damage';

export interface IStockMovement extends Document {
  shopId: Types.ObjectId;
  productId: Types.ObjectId;
  productName: string;
  type: MovementType;
  qty: number;
  qtyBefore: number;
  qtyAfter: number;
  reference?: string;
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
    shopId: { type: Schema.Types.ObjectId, required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    productName: { type: String, required: true },
    type: {
      type: String,
      enum: ['purchase', 'sale', 'adjustment', 'return', 'damage'],
      required: true,
    },
    qty: { type: Number, required: true },
    qtyBefore: { type: Number, required: true },
    qtyAfter: { type: Number, required: true },
    reference: { type: String },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const StockMovement = mongoose.model<IStockMovement>('StockMovement', StockMovementSchema);
