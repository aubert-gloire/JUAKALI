import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAiUsage extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  shopId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  requestCount: number;
}

const AiUsageSchema = new Schema<IAiUsage>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
  date: { type: String, required: true },
  requestCount: { type: Number, default: 0 },
});

AiUsageSchema.index({ userId: 1, shopId: 1, date: 1 }, { unique: true });
AiUsageSchema.index({ date: 1 });

export const AiUsage = mongoose.model<IAiUsage>('AiUsage', AiUsageSchema);
