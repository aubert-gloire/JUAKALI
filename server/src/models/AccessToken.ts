import mongoose, { Schema, Document, Types } from 'mongoose';

export type TokenPlan = 'monthly' | 'quarterly' | 'yearly' | 'lifetime';

export const TOKEN_DURATION: Record<TokenPlan, number> = {
  monthly: 30,
  quarterly: 90,
  yearly: 365,
  lifetime: 36500,
};

export interface IAccessToken extends Document {
  _id: Types.ObjectId;
  code: string;
  plan: TokenPlan;
  durationDays: number;
  shopId?: Types.ObjectId;
  redeemedBy?: Types.ObjectId;
  redeemedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AccessTokenSchema = new Schema<IAccessToken>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    plan: { type: String, enum: ['monthly', 'quarterly', 'yearly', 'lifetime'], required: true },
    durationDays: { type: Number, required: true, min: 1 },
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', default: null },
    redeemedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    redeemedAt: { type: Date, default: null },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

AccessTokenSchema.index({ shopId: 1 });

export const AccessToken = mongoose.model<IAccessToken>('AccessToken', AccessTokenSchema);
