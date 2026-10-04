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

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type ResetStaffPasswordInput = z.infer<typeof resetStaffPasswordSchema>;
