import { api } from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type InstallmentStatus = 'pending' | 'partial' | 'paid' | 'overdue';
export type CreditStatus = 'active' | 'paid' | 'overdue' | 'defaulted';

export interface Installment {
  _id: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: InstallmentStatus;
  paidAt?: string;
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
  status: CreditStatus;
  installments: Installment[];
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
  update: (id: string, body: { notes?: string; customerPhone?: string }) =>
    api.patch<{ account: CreditAccount }>(`/credits/${id}`, body),
  addInstallment: (id: string, body: { dueDate: string; amount: number; notes?: string }) =>
    api.post<{ account: CreditAccount }>(`/credits/${id}/installments`, body),
  recordPayment: (id: string, body: { amount: number; installmentId?: string; notes?: string }) =>
    api.post<{ account: CreditAccount }>(`/credits/${id}/payment`, body),
};

export const CREDIT_STATUS_LABELS: Record<CreditStatus, string> = {
  active: 'Active',
  paid: 'Paid',
  overdue: 'Overdue',
  defaulted: 'Defaulted',
};
