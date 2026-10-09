import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Plus, Search, Upload, Edit2, Package, Sliders, X, ChevronDown,
} from 'lucide-react';
import { categoriesApi, productsApi, Category, Product } from '@/lib/inventoryApi';
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
  reorderLevel:  z.coerce.number().int().min(0).default(5),
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

function CategoryBadge({ cat }: { cat?: Category | null }) {
  if (!cat) return <span className="text-slate-400 text-xs">—</span>;
  return (
    <span
      className="badge text-white text-[10px] px-1.5 py-0.5"
      style={{ backgroundColor: cat.color ?? '#6B7280' }}
    >
      {cat.name}
    </span>
  );
}

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
    defaultValues: editing
      ? {
          name:         editing.name,
          sku:          editing.sku,
          barcode:      editing.barcode ?? '',
          categoryId:   (editing.categoryId as Category | null)?._id ?? '',
          unit:         editing.unit,
          costPrice:    editing.costPrice,
          sellingPrice: editing.sellingPrice,
          reorderLevel: editing.reorderLevel,
          description:  editing.description ?? '',
        }
      : { unit: 'pcs', reorderLevel: 5, costPrice: 0, sellingPrice: 0 },
  });

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

            <div>
              <label className="label">Reorder Level</label>
              <input type="number" {...register('reorderLevel')} className="input mt-1" min={0} step={1} />
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ProductsPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const catsQ = useCategories();
  const prodQ = useProducts(search, categoryFilter, page);
  const categories = catsQ.data?.categories ?? [];

  const openEdit = (p: Product) => { setEditing(p); setModalOpen(true); };
  const openAdd  = () => { setEditing(null); setModalOpen(true); };

  const fmt = (n: number) => `${n.toLocaleString()}`;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Products</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setCsvOpen(true)} className="btn-secondary gap-1.5">
            <Upload size={15} /> Import CSV
          </button>
          <button onClick={openAdd} className="btn-primary gap-1.5">
            <Plus size={15} /> Add Product
          </button>
        </div>
      </div>

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

      {/* Table */}
      <div className="card p-0 overflow-hidden">
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider">SKU</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider hidden md:table-cell">Category</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider">Stock</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider hidden md:table-cell">Cost</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider">Price</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {prodQ.data!.products.map((p) => (
                  <tr
                    key={p._id}
                    className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{p.name}</p>
                      {p.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{p.description}</p>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <CategoryBadge cat={p.categoryId as Category | null} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StockBadge qty={p.stockQty} reorder={p.reorderLevel} />
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 hidden md:table-cell">
                      {fmt(p.costPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                      {fmt(p.sellingPrice)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {(prodQ.data?.pages ?? 0) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
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
    </div>
  );
}
