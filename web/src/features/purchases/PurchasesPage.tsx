import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, ShoppingBag, X, Trash2, CheckCircle, ChevronDown } from 'lucide-react';
import { purchasesApi, suppliersApi, productsApi } from '@/lib/inventoryApi';
import { clsx } from 'clsx';

// ── Schema ────────────────────────────────────────────────────────────────────

const LineSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  qty:       z.coerce.number().int().min(1, 'Min 1'),
  unitCost:  z.coerce.number().int().min(0, 'Must be ≥ 0'),
});

const Schema = z.object({
  supplierId:   z.string().optional(),
  supplierName: z.string().optional(),
  lines:        z.array(LineSchema).min(1, 'Add at least one product'),
  notes:        z.string().optional(),
});
type FormData = z.infer<typeof Schema>;

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  draft:      'bg-slate-100 text-slate-600',
  ordered:    'bg-blue-100 text-blue-700',
  received:   'bg-green-100 text-green-700',
  partial:    'bg-amber-100 text-amber-700',
  cancelled:  'bg-red-100 text-red-700',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx('badge capitalize', STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600')}>
      {status}
    </span>
  );
}

// ── Create PO Modal ───────────────────────────────────────────────────────────

function CreatePOModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();

  const suppliersQ = useQuery({ queryKey: ['inventory', 'suppliers'], queryFn: () => suppliersApi.list(), staleTime: 60_000 });
  const productsQ  = useQuery({ queryKey: ['inventory', 'products', '', '', 1], queryFn: () => productsApi.list({ limit: 200 }), staleTime: 30_000 });

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: { lines: [{ productId: '', qty: 1, unitCost: 0 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = watch('lines');

  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0);

  const create = useMutation({
    mutationFn: (d: FormData) => purchasesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'purchases'] });
      toast.success('Purchase order created');
      onClose();
      reset();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!open) return null;

  const products = productsQ.data?.products ?? [];
  const suppliers = suppliersQ.data?.suppliers ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-t-2xl md:rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">New Purchase Order</h2>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="p-4 space-y-4">
          {/* Supplier */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Supplier</label>
              <div className="relative mt-1">
                <select {...register('supplierId')} className="input pr-8 appearance-none">
                  <option value="">— Select supplier —</option>
                  {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="label">Or enter supplier name</label>
              <input {...register('supplierName')} className="input mt-1" placeholder="Walk-in / unknown" />
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label">Items *</label>
              <button
                type="button"
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                onClick={() => append({ productId: '', qty: 1, unitCost: 0 })}
              >
                + Add line
              </button>
            </div>

            {errors.lines?.root && (
              <p className="text-xs text-red-500 mb-1">{errors.lines.root.message}</p>
            )}

            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <div className="flex-1 relative">
                    <select {...register(`lines.${i}.productId`)} className="input pr-8 appearance-none text-sm">
                      <option value="">— Product —</option>
                      {products.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    {errors.lines?.[i]?.productId && (
                      <p className="text-xs text-red-500 mt-0.5">{errors.lines[i]?.productId?.message}</p>
                    )}
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      {...register(`lines.${i}.qty`)}
                      className="input text-sm text-center"
                      placeholder="Qty"
                      min={1}
                    />
                  </div>
                  <div className="w-28">
                    <input
                      type="number"
                      {...register(`lines.${i}.unitCost`)}
                      className="input text-sm text-right"
                      placeholder="Unit cost"
                      min={0}
                    />
                  </div>
                  <button
                    type="button"
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors mt-0.5"
                    onClick={() => remove(i)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-end">
            <div className="text-right">
              <p className="text-xs text-slate-400">Total Cost</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                RWF {total.toLocaleString()}
              </p>
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea {...register('notes')} className="input mt-1" rows={2} placeholder="Optional" />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={isSubmitting || create.isPending}>
              {create.isPending ? 'Creating…' : 'Create PO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PurchasesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', 'purchases', page],
    queryFn: () => purchasesApi.list(page),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  const receive = useMutation({
    mutationFn: (id: string) => purchasesApi.receive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'purchases'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'products'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'stats'] });
      toast.success('Stock updated — purchase received');
    },
    onError: (e) => toast.error(e.message),
  });

  const orders = data?.orders ?? [];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Purchases</h1>
        <button onClick={() => setCreateOpen(true)} className="btn-primary gap-1.5">
          <Plus size={15} /> New Purchase Order
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
            <ShoppingBag size={36} className="opacity-30" />
            <p className="text-sm">No purchase orders yet. Create your first PO to receive stock.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider">PO #</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider hidden md:table-cell">Supplier</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider">Status</th>
                    <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider hidden md:table-cell">Lines</th>
                    <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider">Total</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider hidden lg:table-cell">Date</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o._id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{o.orderNumber}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 hidden md:table-cell">
                        {o.supplierName ?? '—'}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-3 text-right text-slate-500 hidden md:table-cell">{o.lines.length}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                        RWF {o.totalCost.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 hidden lg:table-cell">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(o.status === 'draft' || o.status === 'ordered') && (
                          <button
                            onClick={() => receive.mutate(o._id)}
                            disabled={receive.isPending}
                            className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50 transition-colors"
                            title="Mark as received & update stock"
                          >
                            <CheckCircle size={13} /> Receive
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(data?.pages ?? 0) > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-500">
                  {data!.total} orders · Page {data!.page} of {data!.pages}
                </p>
                <div className="flex gap-1">
                  <button className="btn-secondary py-1 px-3 text-xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
                  <button className="btn-secondary py-1 px-3 text-xs" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <CreatePOModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
