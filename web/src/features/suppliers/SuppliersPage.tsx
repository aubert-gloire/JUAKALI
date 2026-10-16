import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Edit2, Truck, X, Phone, Mail, Trash2, Printer, Download, FileText } from 'lucide-react';
import { suppliersApi, Supplier } from '@/lib/inventoryApi';
import { exportCSV, printTable, exportPDF, type ShopInfo } from '@/lib/exportUtils';
import { settingsApi } from '@/lib/settingsApi';

const SUPPLIER_COLS = [
  { label: 'Name',    value: (s: Supplier) => s.name },
  { label: 'Phone',   value: (s: Supplier) => s.phone ?? '' },
  { label: 'Email',   value: (s: Supplier) => s.email ?? '' },
  { label: 'Address', value: (s: Supplier) => s.address ?? '' },
  { label: 'Notes',   value: (s: Supplier) => s.notes ?? '' },
];

// ── Schema ────────────────────────────────────────────────────────────────────

const Schema = z.object({
  name:    z.string().min(1, 'Name is required'),
  phone:   z.string().optional(),
  email:   z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  notes:   z.string().optional(),
});
type FormData = z.infer<typeof Schema>;

// ── Modal ─────────────────────────────────────────────────────────────────────

function SupplierModal({
  open, onClose, editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Supplier | null;
}) {
  const qc = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: { name: '', phone: '', email: '', address: '', notes: '' },
  });

  useEffect(() => {
    if (editing) {
      reset({ name: editing.name, phone: editing.phone ?? '', email: editing.email ?? '', address: editing.address ?? '', notes: editing.notes ?? '' });
    } else {
      reset({ name: '', phone: '', email: '', address: '', notes: '' });
    }
  }, [editing, open, reset]);

  const create = useMutation({
    mutationFn: (d: FormData) => suppliersApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory', 'suppliers'] }); toast.success('Supplier added'); onClose(); reset(); },
    onError: (e) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (d: FormData) => suppliersApi.update(editing!._id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory', 'suppliers'] }); toast.success('Supplier updated'); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-t-2xl md:rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            {editing ? 'Edit Supplier' : 'Add Supplier'}
          </h2>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form
          onSubmit={handleSubmit((d) => editing ? update.mutate(d) : create.mutate(d))}
          className="p-4 space-y-3"
        >
          <div>
            <label className="label">Supplier Name *</label>
            <input {...register('name')} className="input mt-1" placeholder="e.g. Kigali Auto Parts Ltd" />
            {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone</label>
              <input {...register('phone')} className="input mt-1" placeholder="+250 7XX XXX XXX" />
            </div>
            <div>
              <label className="label">Email</label>
              <input {...register('email')} className="input mt-1" placeholder="supplier@email.com" />
              {errors.email && <p className="text-xs text-red-500 mt-0.5">{errors.email.message}</p>}
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input {...register('address')} className="input mt-1" placeholder="e.g. Kigali, KK 500" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea {...register('notes')} className="input mt-1" rows={2} placeholder="Payment terms, delivery notes…" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : editing ? 'Update' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SuppliersPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Supplier | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', 'suppliers'],
    queryFn: () => suppliersApi.list(),
    staleTime: 30_000,
  });

  const shopQ = useQuery({
    queryKey: ['settings', 'shop'],
    queryFn: () => settingsApi.getShop(),
    staleTime: 5 * 60_000,
  });
  const shopInfo: ShopInfo | undefined = shopQ.data?.shop
    ? { name: shopQ.data.shop.name, location: shopQ.data.shop.location, phone: shopQ.data.shop.phone, email: shopQ.data.shop.email, tin: shopQ.data.shop.tin }
    : undefined;

  const suppliers = data?.suppliers ?? [];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Suppliers</h1>
        <div className="flex items-center gap-2">
          {suppliers.length > 0 && (<>
            <button onClick={() => printTable(suppliers, SUPPLIER_COLS, 'Suppliers', shopInfo)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><Printer size={13} /> Print</button>
            <button onClick={() => exportCSV(suppliers, SUPPLIER_COLS, 'suppliers')} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><Download size={13} /> CSV</button>
            <button onClick={() => exportPDF(suppliers, SUPPLIER_COLS, 'Suppliers', shopInfo)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><FileText size={13} /> PDF</button>
          </>)}
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary gap-1.5">
            <Plus size={15} /> Add Supplier
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
            <Truck size={36} className="opacity-30" />
            <p className="text-sm">No suppliers yet. Add your first supplier.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider hidden md:table-cell">Contact</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wider hidden lg:table-cell">Address</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s._id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{s.name}</p>
                      {s.notes && <p className="text-xs text-slate-400 truncate max-w-[200px]">{s.notes}</p>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="space-y-0.5">
                        {s.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                            <Phone size={11} /> {s.phone}
                          </div>
                        )}
                        {s.email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                            <Mail size={11} /> {s.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">{s.address ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => { setEditing(s); setModalOpen(true); }}
                          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-900/20 dark:hover:text-primary-400 transition-colors"
                        >
                          <Edit2 size={11} /> Edit
                        </button>
                        <button
                          onClick={() => setDeactivateTarget(s)}
                          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SupplierModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
      />
      {deactivateTarget && (
        <DeactivateSupplierModal
          supplier={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
        />
      )}
    </div>
  );
}

function DeactivateSupplierModal({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => suppliersApi.deactivate(supplier._id),
    onSuccess: () => {
      toast.success(`${supplier.name} removed`);
      qc.invalidateQueries({ queryKey: ['inventory', 'suppliers'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-xl w-full max-w-sm shadow-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <Trash2 size={18} className="text-red-500 flex-shrink-0" />
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Delete Supplier</h2>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Remove <strong>{supplier.name}</strong> from your supplier list? Purchase history is preserved.
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-danger"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Deleting…' : 'Delete Supplier'}
          </button>
        </div>
      </div>
    </div>
  );
}
