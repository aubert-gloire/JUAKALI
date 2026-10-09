import { z } from 'zod';

export const AddInstallmentSchema = z.object({
  dueDate: z.string().min(1, 'Due date required'),
  amount: z.coerce.number().int().min(1, 'Amount must be at least 1'),
  notes: z.string().optional(),
});

export const RecordPaymentSchema = z.object({
  amount: z.coerce.number().int().min(1, 'Amount must be at least 1'),
  installmentId: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateCreditSchema = z.object({
  notes: z.string().optional(),
  customerPhone: z.string().optional(),
});
