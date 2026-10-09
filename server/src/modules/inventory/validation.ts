import { z } from 'zod';

export const CategoryBodySchema = z.object({
  name: z.string().min(1).max(50).trim(),
  color: z.string().optional(),
});

export const ProductBodySchema = z.object({
  name: z.string().min(1).max(200).trim(),
  sku: z.string().min(1).max(50).trim().optional(),
  barcode: z.string().trim().optional(),
  categoryId: z.string().optional(),
  unit: z.string().default('pcs'),
  costPrice: z.number().int().min(0),
  sellingPrice: z.number().int().min(0),
  reorderLevel: z.number().int().min(0).default(5),
  description: z.string().optional(),
});

export const ProductPatchSchema = ProductBodySchema.partial();

export const StockAdjustSchema = z.object({
  qty: z.number().int(),
  notes: z.string().optional(),
});

export const SupplierBodySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  phone: z.string().trim().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const SupplierPatchSchema = SupplierBodySchema.partial();

export const PurchaseLineSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().min(1),
  unitCost: z.number().int().min(0),
});

export const PurchaseCreateSchema = z.object({
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  lines: z.array(PurchaseLineSchema).min(1),
  notes: z.string().optional(),
});

export const PurchasePatchSchema = z.object({
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  lines: z.array(PurchaseLineSchema).min(1).optional(),
  notes: z.string().optional(),
  status: z.enum(['draft', 'ordered', 'cancelled']).optional(),
});

export const CsvImportSchema = z.object({
  csv: z.string().min(1),
});
