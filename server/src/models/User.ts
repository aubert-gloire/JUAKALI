import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  preferredLanguage: 'en' | 'fr' | 'rw';
  isActive: boolean;
  lastLoginAt?: Date;
  mustChangePassword: boolean;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    preferredLanguage: { type: String, enum: ['en', 'fr', 'rw'], default: 'en' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    mustChangePassword: { type: Boolean, default: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret['passwordHash'];
        delete ret['failedLoginAttempts'];
        delete ret['lockedUntil'];
        return ret;
      },
    },
  },
);

UserSchema.index({ isActive: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
