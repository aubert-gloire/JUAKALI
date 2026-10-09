import { api } from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreditStatus = 'active' | 'paid' | 'overdue' | 'defaulted';

export interface PaymentRecord {
  _id: string;
  amount: number;
  recordedAt: string;
  notes?: string;
}

export interface CreditAccount {
  _id: string;
  saleId: string;
  saleNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  dueDate?: string;
  status: CreditStatus;
  payments: PaymentRecord[];
  notes?: string;
  createdAt: string;
}

export interface ReminderItem {
  creditAccountId: string;
  customerName: string;
  customerPhone?: string;
  saleNumber: string;
  amount: number;
  dueDate: string;
  type: 'overdue' | 'today' | 'upcoming';
}

export interface RemindersResponse {
  overdueCount: number;
  todayCount: number;
  upcomingCount: number;
  total: number;
  items: ReminderItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function qs(params?: Record<string, string | number | boolean | undefined>) {
  if (!params) return '';
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return q ? `?${q}` : '';
}

// ── API ───────────────────────────────────────────────────────────────────────

export const creditsApi = {
  list: (params?: { page?: number; status?: string }) =>
    api.get<{ accounts: CreditAccount[]; total: number; page: number; pages: number }>(
      `/credits${qs(params)}`,
    ),
  get: (id: string) => api.get<{ account: CreditAccount }>(`/credits/${id}`),
  reminders: () => api.get<RemindersResponse>('/credits/reminders'),
  update: (id: string, body: { notes?: string; customerPhone?: string; dueDate?: string }) =>
    api.patch<{ account: CreditAccount }>(`/credits/${id}`, body),
  recordPayment: (id: string, body: { amount: number; notes?: string }) =>
    api.post<{ account: CreditAccount }>(`/credits/${id}/payment`, body),
};
