import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(10, 'Password must be at least 10 characters'),
});

export const inviteUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().toLowerCase(),
  phone: z.string().optional(),
  role: z.enum(['manager', 'cashier']),
  tempPassword: z.string().min(10, 'Temporary password must be at least 10 characters'),
});

export const resetStaffPasswordSchema = z.object({
  userId: z.string().min(1),
  newPassword: z.string().min(10, 'Password must be at least 10 characters'),
});

export const updateRoleSchema = z.object({
  role: z.enum(['manager', 'cashier']),
});

export const updateShopSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  location: z.string().min(1).max(200).optional(),
  phone: z.string().optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  receiptFooter: z.string().max(300).optional(),
  allowNegativeStock: z.boolean().optional(),
  lowStockDefault: z.number().int().min(0).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type ResetStaffPasswordInput = z.infer<typeof resetStaffPasswordSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type UpdateShopInput = z.infer<typeof updateShopSchema>;
