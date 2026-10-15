import { z } from 'zod';

export const SaleItemSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().min(1),
});

export const CompleteSaleSchema = z.object({
  items: z.array(SaleItemSchema).min(1, 'Cart cannot be empty'),
  discountAmount: z.number().int().min(0).default(0),
  paymentMethod: z.enum(['cash', 'mobile_money', 'card', 'credit']),
  amountTendered: z.number().int().min(0).optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
  creditDueDate: z.string().optional(),
  creditUpfrontAmount: z.number().int().min(0).optional(),
  creditInstallments: z.array(z.object({
    dueDate: z.string(),
    amount: z.number().int().min(1),
    notes: z.string().optional(),
  })).optional(),
});

export const VoidSaleSchema = z.object({
  reason: z.string().min(1, 'Void reason is required'),
});

export const CustomerSchema = z.object({
  name: z.string().min(1).trim(),
  phone: z.string().trim().optional(),
  email: z.string().email().optional().or(z.literal('')),
  tin: z.string().trim().optional(),
  notes: z.string().optional(),
});

export const ExpenseSchema = z.object({
  category: z.enum(['rent', 'utilities', 'salary', 'transport', 'supplies', 'maintenance', 'other']),
  amount: z.number().int().min(1),
  description: z.string().min(1).trim(),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date' }),
});
