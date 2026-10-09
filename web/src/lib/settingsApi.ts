import { api } from './api';

export interface ShopStaff {
  userId: string;
  membershipId: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: string;
  role: 'owner' | 'manager' | 'cashier';
}

export interface ShopDetails {
  _id: string;
  name: string;
  location: string;
  phone?: string;
  currency: string;
  timezone: string;
  receiptFooter?: string;
  allowNegativeStock: boolean;
  lowStockDefault: number;
}

export const settingsApi = {
  getShop: () => api.get<{ shop: ShopDetails }>('/auth/shop'),
  updateShop: (data: Partial<Omit<ShopDetails, '_id'>>) =>
    api.patch<{ shop: ShopDetails }>('/auth/shop', data),
  listStaff: () => api.get<{ users: ShopStaff[] }>('/auth/users'),
  inviteStaff: (data: { name: string; email: string; phone?: string; role: 'manager' | 'cashier'; tempPassword: string }) =>
    api.post<{ user: { id: string; name: string; email: string } }>('/auth/invite', data),
  updateRole: (membershipId: string, role: 'manager' | 'cashier') =>
    api.patch(`/auth/users/${membershipId}/role`, { role }),
  resetPassword: (userId: string, newPassword: string) =>
    api.post('/auth/reset-staff-password', { userId, newPassword }),
  deactivate: (membershipId: string) =>
    api.delete(`/auth/users/${membershipId}`),
  activate: (membershipId: string) =>
    api.patch(`/auth/users/${membershipId}/activate`, {}),
};
