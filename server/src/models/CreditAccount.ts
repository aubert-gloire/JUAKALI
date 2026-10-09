import { Schema, model, Types, Document } from 'mongoose';

export type InstallmentStatus = 'pending' | 'partial' | 'paid' | 'overdue';
export type CreditStatus = 'active' | 'paid' | 'overdue' | 'defaulted';

export interface IInstallment {
  _id: Types.ObjectId;
  dueDate: Date;
  amount: number;
  paidAmount: number;
  status: InstallmentStatus;
  paidAt?: Date;
  notes?: string;
}

export interface ICreditAccount extends Document {
  shopId: Types.ObjectId;
  saleId: Types.ObjectId;
  saleNumber: string;
  customerId?: Types.ObjectId;
  customerName: string;
  customerPhone?: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  status: CreditStatus;
  installments: IInstallment[];
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InstallmentSchema = new Schema<IInstallment>(
  {
    dueDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'partial', 'paid', 'overdue'], default: 'pending' },
    paidAt: Date,
    notes: String,
  },
  { _id: true },
);

const CreditAccountSchema = new Schema<ICreditAccount>(
  {
    shopId: { type: Schema.Types.ObjectId, required: true, ref: 'Shop' },
    saleId: { type: Schema.Types.ObjectId, required: true, ref: 'Sale' },
    saleNumber: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String, required: true },
    customerPhone: String,
    totalAmount: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, required: true },
    status: { type: String, enum: ['active', 'paid', 'overdue', 'defaulted'], default: 'active' },
    installments: [InstallmentSchema],
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  },
  { timestamps: true },
);

CreditAccountSchema.index({ shopId: 1, status: 1 });
CreditAccountSchema.index({ shopId: 1, createdAt: -1 });
CreditAccountSchema.index({ 'installments.dueDate': 1, status: 1 });

export const CreditAccount = model<ICreditAccount>('CreditAccount', CreditAccountSchema);
