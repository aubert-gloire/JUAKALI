import { api, qs } from './api';

export type Period = 'today' | 'week' | 'month' | 'year';

export type PeriodParams = {
  period?: Period;
  from?: string;
  to?: string;
  [key: string]: string | undefined;
};

export interface OverviewData {
  period: { from: string; to: string };
  revenue: number;
  cost: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  transactions: number;
  avgSaleValue: number;
  totalDiscount: number;
  grossMargin: number;
  paymentBreakdown: { _id: string; count: number; total: number }[];
  dailyTrend: { _id: string; revenue: number; profit: number; transactions: number }[];
}

export interface ProductsData {
  period: { from: string; to: string };
  topByRevenue: { _id: { productId: string; name: string; sku: string }; revenue: number; qty: number; cost: number; profit: number }[];
  topByQty: { _id: { productId: string; name: string; sku: string }; revenue: number; qty: number; cost: number }[];
  stockSnapshot: { totalProducts: number; inventoryValueCost: number; inventoryValueRetail: number; outOfStock: number; lowStock: number };
}

export interface CustomersData {
  period: { from: string; to: string };
  topCustomers: { _id: { customerId: string; name: string }; totalSpent: number; transactions: number; avgSale: number }[];
  creditAging: { _id: string; count: number; balance: number }[];
}

export interface ExpensesData {
  period: { from: string; to: string };
  byCategory: { _id: string; total: number; count: number }[];
  monthly: { _id: string; total: number; count: number }[];
  grandTotal: number;
}

export const reportsApi = {
  overview: (params: PeriodParams) =>
    api.get<OverviewData>(`/reports/overview${qs(params)}`),
  products: (params: PeriodParams) =>
    api.get<ProductsData>(`/reports/products${qs(params)}`),
  customers: (params: PeriodParams) =>
    api.get<CustomersData>(`/reports/customers${qs(params)}`),
  expenses: (params: PeriodParams) =>
    api.get<ExpensesData>(`/reports/expenses${qs(params)}`),
};
