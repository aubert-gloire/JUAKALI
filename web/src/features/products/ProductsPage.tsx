import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Plus, Search, Upload, Edit2, Package, Sliders, X, ChevronDown, PowerOff, TrendingUp, Printer, Download, FileText,
  ShoppingCart, RefreshCw,
} from 'lucide-react';
import { categoriesApi, productsApi, purchasesApi, suppliersApi, type TopSeller, type Supplier, Category, Product } from '@/lib/inventoryApi';
import { exportCSV, printTable, exportPDF } from '@/lib/exportUtils';

const PRODUCT_COLS = [
  { label: 'Name',           value: (p: Product) => p.name },
  { label: 'SKU',            value: (p: Product) => p.sku },
  { label: 'Category',       value: (p: Product) => typeof p.categoryId === 'object' && p.categoryId ? p.categoryId.name : '' },
  { label: 'Stock',          value: (p: Product) => p.stockQty },
  { label: 'Unit',           value: (p: Product) => p.unit },
  { label: 'Cost (RWF)',     value: (p: Product) => p.costPrice },
  { label: 'Price (RWF)',    value: (p: Product) => p.sellingPrice },
];
import { clsx } from 'clsx';

// ── Schemas ───────────────────────────────────────────────────────────────────

const ProductSchema = z.object({
  name:          z.string().min(1, 'Name is required'),
  sku:           z.string().optional(),
  barcode:       z.string().optional(),
  categoryId:    z.string().optional(),
  unit:          z.string().default('pcs'),
  costPrice:     z.coerce.number().int().min(0, 'Must be ≥ 0'),
  sellingPrice:  z.coerce.number().int().min(0, 'Must be ≥ 0'),
  description:   z.string().optional(),
});
type ProductFormData = z.infer<typeof ProductSchema>;

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useCategories() {
  return useQuery({
    queryKey: ['inventory', 'categories'],
    queryFn: () => categoriesApi.list(),
    staleTime: 60_000,
  });
}

function useProducts(search: string, categoryFilter: string, page: number) {
  return useQuery({
    queryKey: ['inventory', 'products', search, categoryFilter, page],
    queryFn: () => productsApi.list({
      search: search || undefined,
      category: categoryFilter || undefined,
      page,
      limit: 50,
    }),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function StockBadge({ qty, reorder }: { qty: number; reorder: number }) {
  if (qty === 0) return <span className="badge bg-red-100 text-red-700">{qty}</span>;
  if (qty <= reorder) return <span className="badge bg-amber-100 text-amber-700">{qty}</span>;
  return <span className="badge bg-green-100 text-green-700">{qty}</span>;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function ProductModal({
  open,
  onClose,
  editing,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  editing: Product | null;
  categories: Category[];
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(ProductSchema),
    defaultValues: { unit: 'pcs', costPrice: 0, sellingPrice: 0, name: '', sku: '', barcode: '', categoryId: '', description: '' },
  });

  useEffect(() => {
    if (editing) {
      reset({
        name:         editing.name,
        sku:          editing.sku ?? '',
        barcode:      editing.barcode ?? '',
        categoryId:   (editing.categoryId as Category | null)?._id ?? '',
        unit:         editing.unit,
        costPrice:    editing.costPrice,
        sellingPrice: editing.sellingPrice,
        description:  editing.description ?? '',
      });
    } else {
      reset({ unit: 'pcs', costPrice: 0, sellingPrice: 0, name: '', sku: '', barcode: '', categoryId: '', description: '' });
    }
  }, [editing, open, reset]);

  const create = useMutation({
    mutationFn: (d: ProductFormData) => productsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory', 'products'] }); qc.invalidateQueries({ queryKey: ['inventory', 'stats'] }); toast.success('Product created'); onClose(); reset(); },
    onError: (e) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (d: ProductFormData) => productsApi.update(editing!._id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory', 'products'] }); toast.success('Product updated'); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  if (!open) return null;

  const onSubmit = (d: ProductFormData) => editing ? update.mutate(d) : create.mutate(d);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-t-2xl md:rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            {editing ? 'Edit Product' : 'Add Product'}
          </h2>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Product Name *</label>
              <input {...register('name')} className="input mt-1" placeholder="e.g. Toyota Shock Absorber" />
              {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name.message}</p>}
            </div>

            <div>
              <label className="label">SKU</label>
              <input {...register('sku')} className="input mt-1" placeholder="Auto-generated" />
            </div>
            <div>
              <label className="label">Barcode</label>
              <input {...register('barcode')} className="input mt-1" placeholder="Optional" />
            </div>

            <div>
              <label className="label">Cost Price (RWF) *</label>
              <input type="number" {...register('costPrice')} className="input mt-1" min={0} step={1} />
              {errors.costPrice && <p className="text-xs text-red-500 mt-0.5">{errors.costPrice.message}</p>}
            </div>
            <div>
              <label className="label">Selling Price (RWF) *</label>
              <input type="number" {...register('sellingPrice')} className="input mt-1" min={0} step={1} />
              {errors.sellingPrice && <p className="text-xs text-red-500 mt-0.5">{errors.sellingPrice.message}</p>}
            </div>

            <div>
              <label className="label">Category</label>
              <select {...register('categoryId')} className="input mt-1">
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Unit</label>
              <select {...register('unit')} className="input mt-1">
                {['pcs', 'set', 'pair', 'litre', 'kg', 'box', 'roll'].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="label">Description</label>
              <textarea {...register('description')} className="input mt-1" rows={2} placeholder="Optional notes" />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : editing ? 'Update Product' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CSV Import Modal ──────────────────────────────────────────────────────────

function CsvModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);

  const importMut = useMutation({
    mutationFn: (csv: string) => productsApi.importCsv(csv),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ['inventory', 'products'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'stats'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const csv = ev.target?.result as string;
      importMut.mutate(csv);
    };
    reader.readAsText(file);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-t-2xl md:rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Import Products (CSV)</h2>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-600 p-6 text-center">
            <Upload size={28} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-600 dark:text-slate-300">Drop a CSV file or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">Required columns: <code>name</code>, <code>costPrice</code>, <code>sellingPrice</code></p>
            <p className="text-xs text-slate-400">Optional: <code>sku</code>, <code>barcode</code>, <code>unit</code>, <code>stockQty</code>, <code>reorderLevel</code>, <code>description</code></p>
            <button
              className="btn-primary mt-3"
              onClick={() => fileRef.current?.click()}
              disabled={importMut.isPending}
            >
              {importMut.isPending ? 'Importing…' : 'Choose File'}
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </div>

          {result && (
            <div className={clsx('rounded-lg p-3 text-sm', result.errors.length > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200')}>
              <p className="font-medium">{result.created} created · {result.updated} updated</p>
              {result.errors.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-amber-800">
                  {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              )}
            </div>
          )}

          <button onClick={onClose} className="btn-secondary w-full">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Restock Modal ─────────────────────────────────────────────────────────────

function RestockModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient();
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState(String(product.costPrice || ''));
  const [sellingPrice, setSellingPrice] = useState(String(product.sellingPrice || ''));
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');

  const suppliersQ = useQuery({
    queryKey: ['inventory', 'suppliers'],
    queryFn: () => suppliersApi.list(),
    staleTime: 60_000,
  });
  const suppliers: Supplier[] = suppliersQ.data?.suppliers ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      const costNum = parseInt(unitCost) || 0;
      const sellNum = parseInt(sellingPrice) || 0;
      const { order } = await purchasesApi.create({
        supplierId: supplierId || undefined,
        lines: [{ productId: product._id, qty: parseInt(qty), unitCost: costNum }],
        notes: notes || undefined,
      });
      await purchasesApi.receive(order._id);
      if (costNum !== product.costPrice || sellNum !== product.sellingPrice) {
        await productsApi.update(product._id, { costPrice: costNum, sellingPrice: sellNum });
      }
    },
    onSuccess: () => {
      toast.success(`${parseInt(qty)} ${product.unit} added to ${product.name}`);
      qc.invalidateQueries({ queryKey: ['inventory', 'products'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'purchases'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'stats'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const qtyNum = parseInt(qty) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-xl w-full max-w-sm shadow-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <RefreshCw size={18} className="text-blue-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">Receive Stock — {product.name}</p>
            <p className="text-xs text-slate-400">Current: {product.stockQty} {product.unit}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label text-xs">Qty received *</label>
            <input
              type="number"
              min={1}
              className="input mt-1 text-sm"
              placeholder="e.g. 20"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            {qtyNum > 0 && (
              <p className="text-xs text-green-600 mt-1">→ {product.stockQty + qtyNum} {product.unit}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Cost Price (RWF)</label>
              <input
                type="number"
                min={0}
                className="input mt-1 text-sm"
                placeholder="0"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Selling Price (RWF)</label>
              <input
                type="number"
                min={0}
                className="input mt-1 text-sm"
                placeholder="0"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label text-xs">Supplier</label>
            <select
              className="input mt-1 text-sm"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">Unknown / Walk-in</option>
              {suppliers.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs">Notes</label>
            <input className="input mt-1 text-sm" placeholder="Optional…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary flex-1"
            disabled={qtyNum <= 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : 'Confirm Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Product grid card ─────────────────────────────────────────────────────────

function ProductGridCard({
  product, onSell, onRestock, onEdit, onDeactivate,
}: {
  product: Product;
  onSell: (p: Product) => void;
  onRestock: (p: Product) => void;
  onEdit: (p: Product) => void;
  onDeactivate: (p: Product) => void;
}) {
  const cat = product.categoryId as Category | null;
  const color = cat?.color ?? '#6B7280';
  const isOut = product.stockQty === 0;

  return (
    <div className="card p-3 flex flex-col gap-2">
      <div className="h-1 rounded-full" style={{ backgroundColor: color }} />
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight">{product.name}</p>
        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{product.sku}</p>
      </div>
      <div className="flex items-center justify-between">
        <StockBadge qty={product.stockQty} reorder={product.reorderLevel} />
        <span className="text-sm font-bold text-primary-600 dark:text-primary-400 tabular-nums">
          {product.sellingPrice.toLocaleString()}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <button
          onClick={() => onSell(product)}
          disabled={isOut}
          className="flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ShoppingCart size={11} /> Sell
        </button>
        <button
          onClick={() => onRestock(product)}
          className="flex items-center justify-center gap-1 text-xs font-medium py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        >
          <RefreshCw size={11} /> Restock
        </button>
        <button
          onClick={() => onEdit(product)}
          className="flex items-center justify-center gap-1 text-xs font-medium py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-primary-50 hover:text-primary-600 transition-colors"
        >
          <Edit2 size={11} /> Edit
        </button>
        <button
          onClick={() => onDeactivate(product)}
          className="flex items-center justify-center gap-1 text-xs font-medium py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          title="Deactivate product"
        >
          <PowerOff size={11} /> Off
        </button>
      </div>
    </div>
  );
}

// ── Top Sellers panel ─────────────────────────────────────────────────────────

function TopSellersPanel() {
  const { data } = useQuery({
    queryKey: ['inventory', 'products', 'top-sellers'],
    queryFn: () => productsApi.topSellers(8),
    staleTime: 60_000,
  });

  const rows: TopSeller[] = data?.topSellers ?? [];
  if (rows.length === 0) return null;

  const maxRevenue = rows[0]?.revenue ?? 1;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={15} className="text-primary-500" />
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Top Selling Products</h2>
        <span className="ml-auto text-xs text-slate-400">All time · by revenue</span>
      </div>
      <div className="space-y-2.5">
        {rows.map((p, i) => {
          const pct = (p.revenue / maxRevenue) * 100;
          return (
            <div key={p.productId}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 w-4 text-right flex-shrink-0">{i + 1}</span>
                  <span className="text-sm text-slate-800 dark:text-slate-200 font-medium truncate">{p.productName}</span>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{p.qtySold.toLocaleString()} sold</span>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                    RWF {p.revenue.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-green-500 ml-1.5">+{p.profit.toLocaleString()}</span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden ml-6">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ProductsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Product | null>(null);
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);

  const catsQ = useCategories();
  const prodQ = useProducts(search, categoryFilter, page);
  const categories = catsQ.data?.categories ?? [];

  const openEdit = (p: Product) => { setEditing(p); setModalOpen(true); };
  const openAdd  = () => { setEditing(null); setModalOpen(true); };
  const onSell   = (p: Product) => navigate('/sell', { state: { addProduct: p } });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Stock</h1>

        <div className="flex items-center gap-2 flex-wrap">
          {(prodQ.data?.products.length ?? 0) > 0 && (<>
            <button onClick={() => printTable(prodQ.data!.products, PRODUCT_COLS, 'Products')} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><Printer size={13} /> Print</button>
            <button onClick={() => exportCSV(prodQ.data!.products, PRODUCT_COLS, 'products')} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><Download size={13} /> CSV</button>
            <button onClick={() => exportPDF(prodQ.data!.products, PRODUCT_COLS, 'Products')} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><FileText size={13} /> PDF</button>
          </>)}
          <button onClick={() => setCsvOpen(true)} className="btn-secondary gap-1.5">
            <Upload size={15} /> Import CSV
          </button>
          <button onClick={openAdd} className="btn-primary gap-1.5">
            <Plus size={15} /> Add Product
          </button>
        </div>
      </div>

      {/* Top sellers */}
      <TopSellersPanel />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-8"
            placeholder="Search products…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="relative">
          <select
            className="input pr-8 appearance-none"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <button
          className={clsx('btn-secondary gap-1.5', categoryFilter && 'border-primary-300 bg-primary-50 text-primary-700')}
          onClick={() => { setCategoryFilter(''); setSearch(''); setPage(1); }}
        >
          <Sliders size={14} />
          {categoryFilter || search ? 'Clear' : 'Filter'}
        </button>
      </div>

      {/* Products grid */}
      <div className="card p-4">
        {prodQ.isLoading ? (
          <div className="flex items-center justify-center h-40 text-slate-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : (prodQ.data?.products.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
            <Package size={36} className="opacity-30" />
            <p className="text-sm">No products yet. Add your first product or import a CSV.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {prodQ.data!.products.map((p) => (
              <ProductGridCard
                key={p._id}
                product={p}
                onSell={onSell}
                onRestock={setRestockTarget}
                onEdit={openEdit}
                onDeactivate={setDeactivateTarget}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {(prodQ.data?.pages ?? 0) > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700 mt-4">
            <p className="text-xs text-slate-500">
              {prodQ.data!.total} products · Page {prodQ.data!.page} of {prodQ.data!.pages}
            </p>
            <div className="flex gap-1">
              <button
                className="btn-secondary py-1 px-3 text-xs"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </button>
              <button
                className="btn-secondary py-1 px-3 text-xs"
                disabled={page >= (prodQ.data?.pages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <ProductModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        categories={categories}
      />
      <CsvModal open={csvOpen} onClose={() => setCsvOpen(false)} />

      {deactivateTarget && (
        <DeactivateProductModal
          product={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
        />
      )}
      {restockTarget && (
        <RestockModal product={restockTarget} onClose={() => setRestockTarget(null)} />
      )}
    </div>
  );
}

function DeactivateProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => productsApi.deactivate(product._id),
    onSuccess: () => {
      toast.success(`${product.name} deactivated`);
      qc.invalidateQueries({ queryKey: ['inventory', 'products'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-xl w-full max-w-sm shadow-2xl p-5">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Deactivate Product</h2>
        <p className="text-sm text-slate-500 mb-5">
          <strong>{product.name}</strong> will be hidden from the POS and inventory. Existing sales history is preserved.
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-danger"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}
