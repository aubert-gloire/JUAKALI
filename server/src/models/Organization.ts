import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IOrganization extends Document {
  _id: Types.ObjectId;
  name: string;
  ownerUserId: Types.ObjectId;
  status: 'active' | 'suspended';
  settings: {
    defaultLanguage: 'en' | 'fr' | 'rw';
  };
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    settings: {
      defaultLanguage: { type: String, enum: ['en', 'fr', 'rw'], default: 'en' },
    },
  },
  { timestamps: true },
);

OrganizationSchema.index({ status: 1 });

export const Organization = mongoose.model<IOrganization>('Organization', OrganizationSchema);
