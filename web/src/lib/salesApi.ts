import { api } from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'mobile_money' | 'card' | 'credit';
export type SaleStatus = 'completed' | 'voided';
export type ExpenseCategory =
  | 'rent' | 'utilities' | 'salary' | 'transport'
  | 'supplies' | 'maintenance' | 'other';

export interface SaleItem {
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  unitCost: number;
  unitPrice: number;
  totalCost: number;
  totalPrice: number;
}

export interface Sale {
  _id: string;
  saleNumber: string;
  items: SaleItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  totalCost: number;
  profit: number;
  paymentMethod: PaymentMethod;
  amountTendered?: number;
  change?: number;
  customerId?: string;
  customerName?: string;
  status: SaleStatus;
  voidedAt?: string;
  voidReason?: string;
  cashierId: string;
  notes?: string;
  createdAt: string;
}

export interface SalesStats {
  range: string;
  revenue: number;
  cost: number;
  profit: number;
  expenses: number;
  netProfit: number;
  transactions: number;
}

export interface TrendPoint {
  date: string;
  day: string;
  revenue: number;
  profit: number;
  transactions: number;
}

export interface Customer {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  totalSpent: number;
}

export interface Expense {
  _id: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  date: string;
  recordedBy: string;
  createdAt: string;
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

// ── Stats ─────────────────────────────────────────────────────────────────────

export const statsApi = {
  get: (range?: 'today' | 'week' | 'month') =>
    api.get<SalesStats>(`/sales/stats${qs(range ? { range } : undefined)}`),
  trend: () => api.get<{ trend: TrendPoint[] }>('/sales/trend'),
};

// ── Sales ─────────────────────────────────────────────────────────────────────

export type CartItem = { productId: string; qty: number };

export type CompleteSaleBody = {
  items: CartItem[];
  discountAmount?: number;
  paymentMethod: PaymentMethod;
  amountTendered?: number;
  customerId?: string;
  customerName?: string;
  notes?: string;
  creditDueDate?: string;
};

export type SalesListParams = {
  page?: number;
  status?: string;
  paymentMethod?: string;
  from?: string;
  to?: string;
};

export const salesApi = {
  list: (params?: SalesListParams) =>
    api.get<{ sales: Sale[]; total: number; page: number; pages: number }>(
      `/sales${qs(params as Record<string, string | number | boolean | undefined>)}`,
    ),
  get: (id: string) => api.get<{ sale: Sale }>(`/sales/${id}`),
  complete: (body: CompleteSaleBody) => api.post<{ sale: Sale }>('/sales', body),
  void: (id: string, reason: string) =>
    api.post<{ sale: Sale }>(`/sales/${id}/void`, { reason }),
};

// ── Customers ─────────────────────────────────────────────────────────────────

export type CustomerBody = { name: string; phone?: string; email?: string; notes?: string };

export const customersApi = {
  list: (search?: string) =>
    api.get<{ customers: Customer[] }>(`/sales/customers/list${qs(search ? { search } : undefined)}`),
  create: (body: CustomerBody) => api.post<{ customer: Customer }>('/sales/customers', body),
  update: (id: string, body: Partial<CustomerBody>) =>
    api.patch<{ customer: Customer }>(`/sales/customers/${id}`, body),
};

// ── Expenses ──────────────────────────────────────────────────────────────────

export type ExpenseBody = {
  category: ExpenseCategory;
  amount: number;
  description: string;
  date: string;
};

export const expensesApi = {
  list: (page?: number) =>
    api.get<{ expenses: Expense[]; total: number; page: number; pages: number }>(
      `/sales/expenses${qs(page ? { page } : undefined)}`,
    ),
  create: (body: ExpenseBody) => api.post<{ expense: Expense }>('/sales/expenses', body),
  delete: (id: string) => api.delete(`/sales/expenses/${id}`),
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  card: 'Card',
  credit: 'Credit',
};

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Rent',
  utilities: 'Utilities',
  salary: 'Salary',
  transport: 'Transport',
  supplies: 'Supplies',
  maintenance: 'Maintenance',
  other: 'Other',
};
