import mongoose, { Schema, Document, Types } from 'mongoose';

export type MembershipRole = 'owner' | 'manager' | 'cashier';

export interface IMembership extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  shopId: Types.ObjectId;
  role: MembershipRole;
  createdAt: Date;
  updatedAt: Date;
}

const MembershipSchema = new Schema<IMembership>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
    role: { type: String, enum: ['owner', 'manager', 'cashier'], required: true },
  },
  { timestamps: true },
);

MembershipSchema.index({ userId: 1, shopId: 1 }, { unique: true });
MembershipSchema.index({ shopId: 1 });
MembershipSchema.index({ organizationId: 1 });
MembershipSchema.index({ userId: 1 });

export const Membership = mongoose.model<IMembership>('Membership', MembershipSchema);
