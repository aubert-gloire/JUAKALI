import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Plus, ShoppingBag, X, Trash2, CheckCircle, ChevronDown,
  XCircle, Search, Printer, Download, FileText, Package,
  ChevronLeft, ChevronRight, MoreHorizontal, AlertTriangle, RefreshCw, Phone, Mail,
} from 'lucide-react';
import { purchasesApi, suppliersApi, productsApi, type PurchaseOrder, type Product, type Supplier } from '@/lib/inventoryApi';
import { exportCSV, printTable, exportPDF } from '@/lib/exportUtils';
import { RestockModal } from '@/components/RestockModal';
import { clsx } from 'clsx';

const PO_COLS = [
  { label: 'PO #',             value: (o: PurchaseOrder) => o.orderNumber },
  { label: 'Date',             value: (o: PurchaseOrder) => new Date(o.createdAt).toLocaleDateString('en-RW') },
  { label: 'Supplier',         value: (o: PurchaseOrder) => o.supplierName ?? '' },
  { label: 'Products',         value: (o: PurchaseOrder) => o.lines.map((l) => `${l.productName} ×${l.qty}`).join('; ') },
  { label: 'Total Cost (RWF)', value: (o: PurchaseOrder) => o.totalCost },
  { label: 'Status',           value: (o: PurchaseOrder) => o.status },
];

// ── Schema ────────────────────────────────────────────────────────────────────

const LineSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  qty:       z.coerce.number().int().min(1, 'Min 1'),
  unitCost:  z.coerce.number().int().min(0, 'Must be ≥ 0'),
});

const Schema = z.object({
  supplierId:    z.string().optional(),
  supplierName:  z.string().optional(),
  supplierPhone: z.string().trim().optional(),
  supplierEmail: z.string().trim().optional(),
  lines:         z.array(LineSchema).min(1, 'Add at least one product'),
  notes:         z.string().optional(),
});
type FormData = z.infer<typeof Schema>;

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; pill: string; border: string }> = {
  draft:     { label: 'Draft',     pill: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',                     border: 'border-slate-300 dark:border-slate-600' },
  ordered:   { label: 'Ordered',   pill: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',                      border: 'border-blue-400' },
  received:  { label: 'Received',  pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',          border: 'border-emerald-400' },
  partial:   { label: 'Partial',   pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',                  border: 'border-amber-400' },
  cancelled: { label: 'Cancelled', pill: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',                         border: 'border-red-400' },
};

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={clsx('inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize tracking-wide', cfg.pill)}>
      {cfg.label}
    </span>
  );
}

// ── Create PO Modal ───────────────────────────────────────────────────────────

function CreatePOModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [supplierInput, setSupplierInput] = useState('');
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');

  const suppliersQ = useQuery({ queryKey: ['inventory', 'suppliers'], queryFn: () => suppliersApi.list(), staleTime: 60_000 });
  const productsQ  = useQuery({ queryKey: ['inventory', 'products', '', '', 1], queryFn: () => productsApi.list({ limit: 200 }), staleTime: 30_000 });

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting }, reset } =
    useForm<FormData>({
      resolver: zodResolver(Schema),
      defaultValues: { lines: [{ productId: '', qty: 1, unitCost: 0 }] },
    });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = watch('lines');
  const selectedSupplierId = watch('supplierId');

  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0);

  const create = useMutation({
    mutationFn: (d: FormData) => purchasesApi.create({
      ...d,
      supplierPhone: newSupplierPhone.trim() || undefined,
      supplierEmail: newSupplierEmail.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'purchases'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'suppliers'] });
      toast.success('Purchase order created');
      onClose();
      reset();
      setSupplierInput('');
      setNewSupplierPhone('');
      setNewSupplierEmail('');
    },
    onError: (e) => toast.error(e.message),
  });

  if (!open) return null;

  const products  = productsQ.data?.products ?? [];
  const suppliers = suppliersQ.data?.suppliers ?? [];
  const selectedSupplier = suppliers.find((s) => s._id === selectedSupplierId) ?? null;
  const filteredSuppliers = suppliers.filter((s) => s.name.toLowerCase().includes(supplierInput.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-t-2xl md:rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">New Stock Order</h2>
            <p className="text-xs text-slate-400 mt-0.5">Record incoming stock from a supplier</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* Supplier */}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Supplier</label>
              <div className="relative mt-1.5">
                <input
                  className="input"
                  placeholder="Type a name or pick from saved suppliers…"
                  value={supplierInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSupplierInput(v);
                    setValue('supplierName', v || undefined);
                    setValue('supplierId', undefined);
                    setSupplierOpen(true);
                  }}
                  onFocus={() => setSupplierOpen(true)}
                  onBlur={() => setTimeout(() => setSupplierOpen(false), 150)}
                  autoComplete="off"
                />
                {supplierInput && (
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onMouseDown={(e) => { e.preventDefault(); setSupplierInput(''); setValue('supplierName', undefined); setValue('supplierId', undefined); setNewSupplierPhone(''); setNewSupplierEmail(''); }}
                  >
                    <X size={13} />
                  </button>
                )}
                {supplierOpen && filteredSuppliers.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl max-h-40 overflow-y-auto">
                    {filteredSuppliers.map((s) => (
                      <button
                        key={s._id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSupplierInput(s.name);
                          setValue('supplierId', s._id);
                          setValue('supplierName', s.name);
                          setSupplierOpen(false);
                        }}
                      >
                        <span className="font-medium text-slate-800 dark:text-slate-200">{s.name}</span>
                        {(s.phone || s.email) && (
                          <span className="ml-2 text-[10px] text-slate-400">{s.phone ?? s.email}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedSupplier && (selectedSupplier.phone || selectedSupplier.email) && (
                <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                  {selectedSupplier.phone && (
                    <a href={`https://wa.me/${selectedSupplier.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium">
                      📞 {selectedSupplier.phone}
                    </a>
                  )}
                  {selectedSupplier.email && (
                    <a href={`mailto:${selectedSupplier.email}`} className="flex items-center gap-1 text-blue-600 hover:text-blue-700">
                      ✉ {selectedSupplier.email}
                    </a>
                  )}
                </div>
              )}
              {/* New supplier — show contact fields */}
              {!selectedSupplierId && supplierInput.trim() && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Phone size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="input text-xs py-1.5 pl-7"
                      placeholder="Phone (optional)"
                      value={newSupplierPhone}
                      onChange={(e) => setNewSupplierPhone(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Mail size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="input text-xs py-1.5 pl-7"
                      placeholder="Email (optional)"
                      value={newSupplierEmail}
                      onChange={(e) => setNewSupplierEmail(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Items *</label>
                <button
                  type="button"
                  onClick={() => append({ productId: '', qty: 1, unitCost: 0 })}
                  className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-0.5"
                >
                  <Plus size={12} /> Add item
                </button>
              </div>

              {errors.lines?.root && (
                <p className="text-xs text-red-500 mb-2">{errors.lines.root.message}</p>
              )}

              {/* Column labels */}
              <div className="grid grid-cols-[1fr_64px_96px_32px] gap-2 mb-1 px-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Product</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider text-center">Qty</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider text-right">Unit cost</span>
                <span />
              </div>

              <div className="space-y-2">
                {fields.map((field, i) => (
                  <div key={field.id} className="grid grid-cols-[1fr_64px_96px_32px] gap-2 items-start">
                    <div className="relative">
                      <select {...register(`lines.${i}.productId`)} className="input pr-7 appearance-none text-sm">
                        <option value="">— select —</option>
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
                        ))}
                      </select>
                      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      {errors.lines?.[i]?.productId && (
                        <p className="text-[10px] text-red-500 mt-0.5">{errors.lines[i]?.productId?.message}</p>
                      )}
                    </div>
                    <input
                      type="number"
                      {...register(`lines.${i}.qty`)}
                      className="input text-sm text-center"
                      placeholder="1"
                      min={1}
                    />
                    <input
                      type="number"
                      {...register(`lines.${i}.unitCost`)}
                      className="input text-sm text-right"
                      placeholder="0"
                      min={0}
                    />
                    <button
                      type="button"
                      className="h-9 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors disabled:opacity-30"
                      onClick={() => remove(i)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Notes</label>
              <textarea {...register('notes')} className="input mt-1.5 resize-none" rows={2} placeholder="Optional delivery notes, reference numbers…" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-slate-100 dark:border-slate-800 px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500">Total cost</span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">RWF {total.toLocaleString()}</span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1" disabled={isSubmitting || create.isPending}>
                {create.isPending ? 'Creating…' : 'Create Order'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Order card ────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  supplier,
  onReceive,
  onCancel,
  onDelete,
  receiving,
  cancelling,
}: {
  order: PurchaseOrder;
  supplier?: Supplier;
  onReceive: () => void;
  onCancel: () => void;
  onDelete: () => void;
  receiving: boolean;
  cancelling: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.draft;
  const canAct = order.status === 'draft' || order.status === 'ordered';
  const canDelete = order.status === 'draft' || order.status === 'cancelled';

  return (
    <div className={clsx('bg-white dark:bg-slate-800 rounded-xl border-l-4 shadow-sm hover:shadow-md transition-shadow', cfg.border)}>
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">{order.orderNumber}</span>
              <StatusPill status={order.status} />
            </div>
            <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100 truncate">
              {order.supplierName ?? <span className="text-slate-400 font-normal italic">No supplier</span>}
            </p>
            {supplier && (supplier.phone || supplier.email) && (
              <div className="flex flex-wrap gap-2 mt-0.5">
                {supplier.phone && (
                  <a
                    href={`https://wa.me/${supplier.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    <Phone size={9} /> {supplier.phone}
                  </a>
                )}
                {supplier.email && (
                  <a
                    href={`mailto:${supplier.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700"
                  >
                    <Mail size={9} /> {supplier.email}
                  </a>
                )}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-0.5">
              {new Date(order.createdAt).toLocaleDateString('en-RW', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' · '}
              {order.lines.length} {order.lines.length === 1 ? 'item' : 'items'}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-slate-400">Total</p>
            <p className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {order.totalCost.toLocaleString()} <span className="text-xs font-normal text-slate-400">RWF</span>
            </p>
          </div>
        </div>

        {/* Products preview */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full text-left"
        >
          <div className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
            <Package size={11} />
            <span className="truncate">
              {order.lines.map((l) => `${l.productName} ×${l.qty}`).join(', ')}
            </span>
            <ChevronDown size={11} className={clsx('flex-shrink-0 transition-transform', expanded && 'rotate-180')} />
          </div>
        </button>

        {/* Expanded items */}
        {expanded && (
          <div className="mt-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 divide-y divide-slate-100 dark:divide-slate-700/50">
            {order.lines.map((l, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-medium">{l.productName}</span>
                <div className="flex items-center gap-4 text-slate-500">
                  <span>×{l.qty}</span>
                  <span className="tabular-nums">{l.unitCost.toLocaleString()} RWF</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        {(canAct || canDelete) && (
          <div className="mt-3 flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/50">
            {canAct && (
              <>
                <button
                  onClick={onReceive}
                  disabled={receiving || cancelling}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors"
                >
                  <CheckCircle size={13} />
                  {receiving ? 'Receiving…' : 'Mark Received'}
                </button>
                <button
                  onClick={onCancel}
                  disabled={receiving || cancelling}
                  className="flex items-center justify-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                >
                  <XCircle size={13} />
                  {cancelling ? 'Cancelling…' : 'Cancel'}
                </button>
              </>
            )}
            {canDelete && (
              <button
                onClick={onDelete}
                className="flex items-center justify-center gap-1 text-xs font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
              >
                <Trash2 size={13} />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Status filter tabs ────────────────────────────────────────────────────────

const FILTER_TABS = ['all', 'draft', 'ordered', 'received', 'partial', 'cancelled'] as const;
type FilterTab = typeof FILTER_TABS[number];

// ── Page ──────────────────────────────────────────────────────────────────────

export function PurchasesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterTab>('all');
  const [exportOpen, setExportOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', 'purchases', page],
    queryFn: () => purchasesApi.list(page),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  const lowStockQ = useQuery({
    queryKey: ['inventory', 'lowStock'],
    queryFn: () => productsApi.list({ lowStock: true, limit: 20 }),
    staleTime: 30_000,
  });
  const lowStockItems = lowStockQ.data?.products ?? [];

  const suppliersQ = useQuery({
    queryKey: ['inventory', 'suppliers'],
    queryFn: () => suppliersApi.list(),
    staleTime: 60_000,
  });
  const supplierMap = new Map((suppliersQ.data?.suppliers ?? []).map((s) => [s._id, s]));

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

  const cancel = useMutation({
    mutationFn: (id: string) => purchasesApi.update(id, { status: 'cancelled' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'purchases'] });
      toast.success('Order cancelled');
    },
    onError: (e) => toast.error(e.message),
  });

  const deletePO = useMutation({
    mutationFn: (id: string) => purchasesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'purchases'] });
      toast.success('Order deleted');
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const allOrders = data?.orders ?? [];
  const sq = search.trim().toLowerCase();

  const orders = allOrders
    .filter((o) => statusFilter === 'all' || o.status === statusFilter)
    .filter((o) =>
      !sq ||
      o.orderNumber.toLowerCase().includes(sq) ||
      (o.supplierName?.toLowerCase().includes(sq) ?? false) ||
      o.lines.some((l) => l.productName.toLowerCase().includes(sq)),
    );

  const statusCounts = allOrders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Stock Orders</h1>
          {data && (
            <p className="text-xs text-slate-400 mt-0.5">{data.total} order{data.total !== 1 ? 's' : ''} total</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {allOrders.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setExportOpen((v) => !v)}
                onBlur={() => setTimeout(() => setExportOpen(false), 150)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <MoreHorizontal size={14} />
                Export
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl min-w-[130px] py-1">
                  <button onMouseDown={() => printTable(allOrders, PO_COLS, 'Purchase Orders')} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <Printer size={13} className="text-slate-400" /> Print
                  </button>
                  <button onMouseDown={() => exportCSV(allOrders, PO_COLS, 'purchases')} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <Download size={13} className="text-slate-400" /> CSV
                  </button>
                  <button onMouseDown={() => exportPDF(allOrders, PO_COLS, 'Purchase Orders')} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <FileText size={13} className="text-slate-400" /> PDF
                  </button>
                </div>
              )}
            </div>
          )}
          <button onClick={() => setCreateOpen(true)} className="btn-primary gap-1.5">
            <Plus size={15} /> New Order
          </button>
        </div>
      </div>

      {/* Low stock alerts */}
      {lowStockItems.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200 dark:border-amber-800/50">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} need restocking
            </span>
          </div>
          <div className="divide-y divide-amber-100 dark:divide-amber-800/30">
            {lowStockItems.map((p) => {
              const isOut = p.stockQty === 0;
              return (
                <div key={p._id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{p.name}</p>
                    <p className={clsx('text-xs font-semibold tabular-nums', isOut ? 'text-red-500' : 'text-amber-600')}>
                      {isOut ? 'Out of stock' : `${p.stockQty} ${p.unit} left`}
                    </p>
                  </div>
                  <button
                    onClick={() => setRestockTarget(p)}
                    className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors shadow-sm"
                  >
                    <RefreshCw size={11} /> Restock
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          className="input pl-9 pr-8"
          placeholder="Search by order #, supplier or product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Status filter tabs */}
      {!isLoading && allOrders.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_TABS.map((tab) => {
            const count = tab === 'all' ? allOrders.length : (statusCounts[tab] ?? 0);
            if (tab !== 'all' && count === 0) return null;
            const active = statusFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={clsx(
                  'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors capitalize',
                  active
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600',
                )}
              >
                {tab === 'all' ? 'All' : STATUS_CONFIG[tab]?.label ?? tab}
                <span className={clsx('text-[10px] font-bold tabular-nums', active ? 'text-white/80' : 'text-slate-400')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-52 text-slate-400 gap-3">
          <ShoppingBag size={40} className="opacity-20" />
          <div className="text-center">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {search || statusFilter !== 'all' ? 'No orders match your filters' : 'No stock orders yet'}
            </p>
            {!search && statusFilter === 'all' && (
              <p className="text-xs mt-1">Create your first order to start tracking incoming stock</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <OrderCard
              key={o._id}
              order={o}
              supplier={o.supplierId ? supplierMap.get(o.supplierId) : undefined}
              onReceive={() => receive.mutate(o._id)}
              onCancel={() => cancel.mutate(o._id)}
              onDelete={() => setDeleteTarget(o)}
              receiving={receive.isPending && receive.variables === o._id}
              cancelling={cancel.isPending && cancel.variables === o._id}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {(data?.pages ?? 0) > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-slate-500">
            Page {data!.page} of {data!.pages}
          </p>
          <div className="flex gap-1">
            <button
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <button
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              disabled={page >= (data?.pages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      <CreatePOModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {restockTarget && (
        <RestockModal product={restockTarget} onClose={() => setRestockTarget(null)} />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">Delete {deleteTarget.orderNumber}?</p>
                <p className="text-sm text-slate-500 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                className="btn-danger flex-1"
                disabled={deletePO.isPending}
                onClick={() => deletePO.mutate(deleteTarget._id)}
              >
                {deletePO.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
