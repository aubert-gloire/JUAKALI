import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPlatformAdmin extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  role: 'super_admin' | 'support';
  createdAt: Date;
  updatedAt: Date;
}

const PlatformAdminSchema = new Schema<IPlatformAdmin>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    role: { type: String, enum: ['super_admin', 'support'], default: 'super_admin' },
  },
  { timestamps: true },
);

PlatformAdminSchema.index({ userId: 1 }, { unique: true });

export const PlatformAdmin = mongoose.model<IPlatformAdmin>('PlatformAdmin', PlatformAdminSchema);
