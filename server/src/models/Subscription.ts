import mongoose, { Schema, Document, Types } from 'mongoose';
import type { PlanCode } from './Plan';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'grace'
  | 'suspended'
  | 'cancelled';

export interface ISubscription extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  planCode: PlanCode;
  status: SubscriptionStatus;
  billingCycle: 'monthly' | 'yearly';
  currentPeriodStart: Date;
  currentPeriodEnd?: Date;
  trialEndsAt?: Date;
  graceEndsAt?: Date;
  cancelAtPeriodEnd: boolean;
  overrides?: Record<string, unknown>;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
    },
    planCode: {
      type: String,
      enum: ['pilot', 'starter', 'business', 'enterprise'],
      required: true,
    },
    status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'grace', 'suspended', 'cancelled'],
      default: 'active',
    },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date },
    trialEndsAt: { type: Date },
    graceEndsAt: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    overrides: { type: Schema.Types.Mixed },
    notes: { type: String },
  },
  { timestamps: true },
);

SubscriptionSchema.index({ status: 1 });
SubscriptionSchema.index({ trialEndsAt: 1 });
SubscriptionSchema.index({ currentPeriodEnd: 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
