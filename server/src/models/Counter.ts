import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICounter extends Document {
  _id: Types.ObjectId;
  shopId: Types.ObjectId;
  key: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
  key: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

CounterSchema.index({ shopId: 1, key: 1 }, { unique: true });

export const Counter = mongoose.model<ICounter>('Counter', CounterSchema);

export async function nextSeq(shopId: Types.ObjectId | string, key: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { shopId, key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  ).lean();
  return doc!.seq;
}
