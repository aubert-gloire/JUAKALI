import mongoose, { Schema, Document } from 'mongoose';

export type PlanCode = 'pilot' | 'starter' | 'business' | 'enterprise';

export const ALL_FEATURES = [
  'ai_assistant',
  'stock_counts',
  'advanced_reports',
  'multi_shop',
  'audit_log',
  'csv_import',
] as const;

export type FeatureKey = (typeof ALL_FEATURES)[number];

export interface PlanLimits {
  maxShops: number;
  maxUsers: number;
  maxProducts: number;
  aiRequestsPerUserPerDay: number;
  maxBackups: number;
}

export interface IPlan extends Document {
  code: PlanCode;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  limits: PlanLimits;
  features: FeatureKey[];
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlan>(
  {
    code: { type: String, enum: ['pilot', 'starter', 'business', 'enterprise'], required: true, unique: true },
    name: { type: String, required: true },
    priceMonthly: { type: Number, required: true, min: 0 },
    priceYearly: { type: Number, required: true, min: 0 },
    limits: {
      maxShops: { type: Number, required: true },
      maxUsers: { type: Number, required: true },
      maxProducts: { type: Number, required: true },
      aiRequestsPerUserPerDay: { type: Number, required: true },
      maxBackups: { type: Number, required: true },
    },
    features: [{ type: String }],
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

PlanSchema.index({ isActive: 1, sortOrder: 1 });

export const Plan = mongoose.model<IPlan>('Plan', PlanSchema);
