import mongoose, { Schema, Document, Types } from 'mongoose';

export type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'salary'
  | 'transport'
  | 'supplies'
  | 'maintenance'
  | 'other';

export interface IExpense extends Document {
  shopId: Types.ObjectId;
  category: ExpenseCategory;
  amount: number;
  description: string;
  date: Date;
  recordedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    shopId: { type: Schema.Types.ObjectId, required: true, index: true },
    category: {
      type: String,
      enum: ['rent', 'utilities', 'salary', 'transport', 'supplies', 'maintenance', 'other'],
      required: true,
    },
    amount: { type: Number, required: true, min: 1 },
    description: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

ExpenseSchema.index({ shopId: 1, date: -1 });

export const Expense = mongoose.model<IExpense>('Expense', ExpenseSchema);
