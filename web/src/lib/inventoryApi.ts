import { api } from './api';

function qs(params?: Record<string, string | number | boolean | undefined>) {
  if (!params) return '';
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return q ? `?${q}` : '';
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Category {
  _id: string;
  name: string;
  color: string;
}

export interface Product {
  _id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  categoryId?: Category | null;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  stockQty: number;
  reorderLevel: number;
  isActive: boolean;
  createdAt: string;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  pages: number;
}

export interface Supplier {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
}

export type PurchaseStatus = 'draft' | 'ordered' | 'received' | 'partial' | 'cancelled';

export interface PurchaseOrderLine {
  productId: string;
  productName: string;
  qty: number;
  unitCost: number;
  totalCost: number;
}

export interface PurchaseOrder {
  _id: string;
  orderNumber: string;
  supplierId?: string;
  supplierName?: string;
  status: PurchaseStatus;
  lines: PurchaseOrderLine[];
  totalCost: number;
  notes?: string;
  receivedAt?: string;
  createdAt: string;
}

export interface PurchasesResponse {
  orders: PurchaseOrder[];
  total: number;
  page: number;
  pages: number;
}

// ── Categories ─────────────────────────────────────────────────────────────────

export const categoriesApi = {
  list: () => api.get<{ categories: Category[] }>('/inventory/categories'),
  create: (body: { name: string; color?: string }) =>
    api.post<{ category: Category }>('/inventory/categories', body),
  update: (id: string, body: Partial<{ name: string; color: string }>) =>
    api.patch<{ category: Category }>(`/inventory/categories/${id}`, body),
  delete: (id: string) => api.delete(`/inventory/categories/${id}`),
};

// ── Products ──────────────────────────────────────────────────────────────────

export type ProductCreateBody = {
  name: string;
  sku?: string;
  barcode?: string;
  categoryId?: string;
  unit?: string;
  costPrice: number;
  sellingPrice: number;
  reorderLevel?: number;
  description?: string;
};

export const productsApi = {
  list: (params?: { search?: string; category?: string; lowStock?: boolean; page?: number; limit?: number }) =>
    api.get<ProductsResponse>(`/inventory/products${qs(params)}`),
  stats: () => api.get<{ total: number; lowStock: number; inventoryValue: number }>('/inventory/products/stats'),
  get: (id: string) => api.get<{ product: Product }>(`/inventory/products/${id}`),
  create: (body: ProductCreateBody) => api.post<{ product: Product }>('/inventory/products', body),
  update: (id: string, body: Partial<ProductCreateBody>) =>
    api.patch<{ product: Product }>(`/inventory/products/${id}`, body),
  deactivate: (id: string) => api.delete(`/inventory/products/${id}`),
  adjust: (id: string, qty: number, notes?: string) =>
    api.post(`/inventory/products/${id}/adjust`, { qty, notes }),
  importCsv: (csv: string) =>
    api.post<{ created: number; updated: number; errors: string[] }>('/inventory/products/import', { csv }),
};

// ── Suppliers ─────────────────────────────────────────────────────────────────

export type SupplierBody = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
};

export const suppliersApi = {
  list: () => api.get<{ suppliers: Supplier[] }>('/inventory/suppliers'),
  create: (body: SupplierBody) => api.post<{ supplier: Supplier }>('/inventory/suppliers', body),
  update: (id: string, body: Partial<SupplierBody>) =>
    api.patch<{ supplier: Supplier }>(`/inventory/suppliers/${id}`, body),
  deactivate: (id: string) => api.delete(`/inventory/suppliers/${id}`),
};

// ── Purchases ─────────────────────────────────────────────────────────────────

export type PurchaseCreateBody = {
  supplierId?: string;
  supplierName?: string;
  lines: { productId: string; qty: number; unitCost: number }[];
  notes?: string;
};

export const purchasesApi = {
  list: (page?: number) =>
    api.get<PurchasesResponse>(`/inventory/purchases${qs(page ? { page } : undefined)}`),
  get: (id: string) => api.get<{ order: PurchaseOrder }>(`/inventory/purchases/${id}`),
  create: (body: PurchaseCreateBody) =>
    api.post<{ order: PurchaseOrder }>('/inventory/purchases', body),
  update: (id: string, body: Partial<PurchaseCreateBody & { status: string }>) =>
    api.patch<{ order: PurchaseOrder }>(`/inventory/purchases/${id}`, body),
  receive: (id: string) =>
    api.post<{ order: PurchaseOrder }>(`/inventory/purchases/${id}/receive`, {}),
};
