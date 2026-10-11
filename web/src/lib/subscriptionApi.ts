import { api } from './api';

export type SubscriptionStatus = 'trialing' | 'active' | 'grace' | 'expired';

export interface SubscriptionData {
  status: SubscriptionStatus;
  plan: string | null;
  daysLeft: number;
  graceDaysLeft?: number;
  trialEndsAt?: string;
  accessExpiry?: string;
}

export const subscriptionApi = {
  status: () => api.get<SubscriptionData>('/auth/subscription'),
  redeem: (code: string) => api.post<{ plan: string; daysLeft: number; accessExpiry: string }>('/auth/redeem', { code }),
};
