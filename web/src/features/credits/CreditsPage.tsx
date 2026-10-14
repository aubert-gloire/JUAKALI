import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  CreditCard, ChevronDown, ChevronUp, DollarSign,
  X, Clock, CheckCircle2, AlertTriangle, Printer, Download, FileText, Pencil, Trash2, MessageCircle,
  ShoppingBag, Users, Search,
} from 'lucide-react';
import { settingsApi } from '@/lib/settingsApi';
import {
  creditsApi,
  type CreditAccount,
  type CreditStatus,
  type Installment,
} from '@/lib/creditsApi';
import { salesApi, type SaleItem } from '@/lib/salesApi';
import { Calendar } from 'lucide-react';
import { exportCSV, printTable, exportPDF } from '@/lib/exportUtils';
import { clsx } from 'clsx';

const CREDIT_COLS = [
  { label: 'Customer',      value: (a: CreditAccount) => a.customerName },
  { label: 'Phone',         value: (a: CreditAccount) => a.customerPhone ?? '' },
  { label: 'Sale #',        value: (a: CreditAccount) => a.saleNumber },
  { label: 'Total (RWF)',   value: (a: CreditAccount) => a.totalAmount },
  { label: 'Paid (RWF)',    value: (a: CreditAccount) => a.amountPaid },
  { label: 'Balance (RWF)', value: (a: CreditAccount) => a.balance },
  { label: 'Due Date',      value: (a: CreditAccount) => a.dueDate ? new Date(a.dueDate).toLocaleDateString('en-RW') : '' },
  { label: 'Status',        value: (a: CreditAccount) => a.status },
];

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<CreditStatus, string> = {
  active:    'Active',
  paid:      'Paid',
  overdue:   'Overdue',
  defaulted: 'Defaulted',
};

const STATUS_COLORS: Record<CreditStatus, string> = {
  active:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  paid:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  overdue:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  defaulted: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
};

function StatusBadge({ status }: { status: CreditStatus }) {
  return (
    <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── Pay progress bar ──────────────────────────────────────────────────────────

function PayProgress({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all', pct >= 100 ? 'bg-green-500' : 'bg-primary-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-slate-400 tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

// ── Sale items section ────────────────────────────────────────────────────────

function SaleItemsSection({ saleId }: { saleId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => salesApi.get(saleId),
    staleTime: 5 * 60_000,
  });

  const items: SaleItem[] = data?.sale?.items ?? [];

  if (isLoading) {
    return (
      <div className="mb-3">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Items in Sale</p>
        <div className="h-8 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="mb-3">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
        Items in Sale
      </p>
      <div className="rounded-lg overflow-hidden border border-slate-100 dark:border-slate-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60">
              <th className="text-left px-3 py-1.5 font-medium text-slate-500">Product</th>
              <th className="text-center px-3 py-1.5 font-medium text-slate-500">Qty</th>
              <th className="text-right px-3 py-1.5 font-medium text-slate-500">Unit Price</th>
              <th className="text-right px-3 py-1.5 font-medium text-slate-500">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-t border-slate-50 dark:border-slate-700/50">
                <td className="px-3 py-2 text-slate-800 dark:text-slate-200">
                  <p className="font-medium">{item.productName}</p>
                  {item.sku && <p className="text-[10px] text-slate-400">{item.sku}</p>}
                </td>
                <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300 tabular-nums">
                  {item.qty}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                  {item.unitPrice.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                  {item.totalPrice.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60">
              <td colSpan={3} className="px-3 py-1.5 text-right text-slate-500 font-medium">Total</td>
              <td className="px-3 py-1.5 text-right font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                RWF {items.reduce((s, it) => s + it.totalPrice, 0).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Record Payment modal ──────────────────────────────────────────────────────

const paySchema = z.object({
  amount: z.coerce.number().int().min(1, 'Required'),
  notes: z.string().optional(),
});

function RecordPaymentModal({
  account,
  onClose,
}: {
  account: CreditAccount;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(paySchema),
    defaultValues: { amount: account.balance, notes: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof paySchema>) =>
      creditsApi.recordPayment(account._id, data),
    onSuccess: () => {
      toast.success('Payment recorded');
      qc.invalidateQueries({ queryKey: ['credits'] });
      qc.invalidateQueries({ queryKey: ['credits', 'reminders'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-xl w-full sm:max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Record Payment</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {account.customerName} · Balance: RWF {account.balance.toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-5 space-y-4">
          <div>
            <label className="form-label">Amount Paid (RWF) *</label>
            <input
              type="number"
              min={1}
              max={account.balance}
              className="input"
              {...register('amount')}
            />
            {errors.amount && <p className="form-error">{errors.amount.message}</p>}
            {/* Quick presets */}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <button
                type="button"
                onClick={() => setValue('amount', account.balance)}
                className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 transition-colors"
              >
                Full balance · RWF {account.balance.toLocaleString()}
              </button>
              {account.balance >= 2000 && (
                <button
                  type="button"
                  onClick={() => setValue('amount', Math.floor(account.balance / 2))}
                  className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                >
                  Half · RWF {Math.floor(account.balance / 2).toLocaleString()}
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="form-label">Notes</label>
            <input
              className="input"
              placeholder="e.g. Paid via MoMo…"
              {...register('notes')}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Pay All Debts modal ───────────────────────────────────────────────────────

function PayAllModal({
  customerName,
  accounts,
  onClose,
}: {
  customerName: string;
  accounts: CreditAccount[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const unpaid = accounts.filter((a) => a.status !== 'paid' && a.balance > 0);
  const totalBalance = unpaid.reduce((s, a) => s + a.balance, 0);

  async function handlePayAll() {
    setLoading(true);
    try {
      for (const acc of unpaid) {
        await creditsApi.recordPayment(acc._id, {
          amount: acc.balance,
          notes: notes.trim() || 'Full balance payment',
        });
      }
      toast.success(`All ${unpaid.length} debts cleared for ${customerName}`);
      qc.invalidateQueries({ queryKey: ['credits'] });
      qc.invalidateQueries({ queryKey: ['credits', 'reminders'] });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-xl w-full sm:max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Pay All Debts</h2>
            <p className="text-xs text-slate-400 mt-0.5">{customerName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Summary of debts */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-700/40 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
            {unpaid.map((acc) => (
              <div key={acc._id} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-mono">{acc.saleNumber}</span>
                <span className="font-semibold text-red-600 tabular-nums">
                  RWF {acc.balance.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Total to pay</span>
            <span className="text-lg font-bold text-red-600 tabular-nums">
              RWF {totalBalance.toLocaleString()}
            </span>
          </div>
          <div>
            <label className="form-label">Notes (optional)</label>
            <input
              className="input"
              placeholder="e.g. Full settlement…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn-primary"
              disabled={loading || unpaid.length === 0}
              onClick={handlePayAll}
            >
              {loading ? 'Processing…' : `Pay RWF ${totalBalance.toLocaleString()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edit credit modal ─────────────────────────────────────────────────────────

function EditCreditModal({ account, onClose }: { account: CreditAccount; onClose: () => void }) {
  const qc = useQueryClient();
  const [customerPhone, setCustomerPhone] = useState(account.customerPhone ?? '');
  const [dueDate, setDueDate] = useState(account.dueDate ? account.dueDate.slice(0, 10) : '');
  const [notes, setNotes] = useState(account.notes ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      creditsApi.update(account._id, {
        customerPhone: customerPhone.trim() || undefined,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Credit account updated');
      qc.invalidateQueries({ queryKey: ['credits'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-xl w-full max-w-sm shadow-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Pencil size={18} className="text-primary-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">Edit Credit — {account.customerName}</p>
            <p className="text-xs text-slate-400">Update contact, due date, or notes.</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label text-xs">Customer phone</label>
            <input className="input w-full mt-1 text-sm" placeholder="+250 7XX XXX XXX" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Due date</label>
            <input type="date" className="input w-full mt-1 text-sm" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Notes</label>
            <textarea className="input resize-none text-sm w-full mt-1 min-h-[56px]" placeholder="Optional note…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Individual credit sub-row (inside a customer group) ───────────────────────

function AccountSubRow({
  account,
  shopName,
  shopPhone,
  onEdit,
  onDelete,
}: {
  account: CreditAccount;
  shopName: string;
  shopPhone: string;
  onEdit: (a: CreditAccount) => void;
  onDelete: (a: CreditAccount) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const isOverdue = account.status === 'overdue';

  const dueDateStr = account.dueDate
    ? new Date(account.dueDate).toLocaleDateString('en-RW', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className={clsx(
      'border-t border-slate-100 dark:border-slate-700/50',
      isOverdue ? 'bg-red-50/30 dark:bg-red-900/5' : '',
    )}>
      {/* Sub-row header */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
        onClick={() => setOpen((p) => !p)}
      >
        <ShoppingBag size={13} className="text-slate-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-slate-500">{account.saleNumber}</span>
            <StatusBadge status={account.status} />
          </div>
          <PayProgress paid={account.amountPaid} total={account.totalAmount} />
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-red-600 tabular-nums">
            RWF {account.balance.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400">balance</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {account.status !== 'paid' && account.customerPhone && (
            <button
              title="Send WhatsApp reminder"
              onClick={(e) => {
                e.stopPropagation();
                const contact = shopPhone ? ` | ${shopPhone}` : '';
                const msg = `Dear ${account.customerName}, you have an outstanding balance of RWF ${account.balance.toLocaleString()} for sale #${account.saleNumber}. Please make payment at your earliest convenience. Thank you! — ${shopName}${contact}`;
                window.open(`https://wa.me/${account.customerPhone!.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
              }}
              className="p-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 transition-colors"
            >
              <MessageCircle size={12} />
            </button>
          )}
          {account.status !== 'paid' && (
            <button
              title="Record payment"
              onClick={(e) => { e.stopPropagation(); setShowPay(true); }}
              className="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 transition-colors"
            >
              <DollarSign size={12} />
            </button>
          )}
          <span className="text-slate-400 ml-0.5">
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 ml-6 border-l-2 border-slate-100 dark:border-slate-700">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2 mt-1">
            <div className="bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 text-center border border-slate-100 dark:border-slate-700">
              <p className="text-[9px] text-slate-400 uppercase tracking-wide">Total</p>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                RWF {account.totalAmount.toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 text-center border border-slate-100 dark:border-slate-700">
              <p className="text-[9px] text-slate-400 uppercase tracking-wide">Paid</p>
              <p className="text-xs font-semibold text-green-600 tabular-nums">
                RWF {account.amountPaid.toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 text-center border border-slate-100 dark:border-slate-700">
              <p className="text-[9px] text-slate-400 uppercase tracking-wide">Balance</p>
              <p className="text-xs font-semibold text-red-600 tabular-nums">
                RWF {account.balance.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Sale items */}
          <SaleItemsSection saleId={account.saleId} />

          {/* Installment schedule */}
          {account.installments && account.installments.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Installment Schedule
              </p>
              <div className="space-y-1">
                {account.installments.map((inst: Installment, i: number) => {
                  const isPast = new Date(inst.dueDate) < new Date() && inst.status !== 'paid';
                  return (
                    <div key={inst._id ?? i} className={clsx(
                      'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs',
                      inst.status === 'paid'
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : isPast
                          ? 'bg-red-50 dark:bg-red-900/20'
                          : 'bg-white dark:bg-slate-800',
                    )}>
                      <Calendar size={11} className={clsx(
                        'flex-shrink-0',
                        inst.status === 'paid' ? 'text-green-500' : isPast ? 'text-red-500' : 'text-slate-400',
                      )} />
                      <span className="text-slate-500 w-20 flex-shrink-0 text-[10px]">
                        {new Date(inst.dueDate).toLocaleDateString('en-RW', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                        RWF {inst.amount.toLocaleString()}
                      </span>
                      {inst.paidAmount > 0 && inst.status !== 'paid' && (
                        <span className="text-green-600 text-[10px]">
                          RWF {inst.paidAmount.toLocaleString()} paid
                        </span>
                      )}
                      <span className={clsx(
                        'ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                        inst.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : inst.status === 'overdue' || isPast
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-500',
                      )}>
                        {inst.status === 'paid' ? 'Paid' : inst.status === 'overdue' || isPast ? 'Overdue' : 'Pending'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment history */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Payment History
            </p>
            {account.payments.length === 0 ? (
              <p className="text-xs text-slate-400 pl-1">No payments recorded yet.</p>
            ) : (
              <div className="space-y-1">
                {account.payments
                  .slice()
                  .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
                  .map((p) => (
                    <div
                      key={p._id}
                      className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg px-2.5 py-1.5 text-xs"
                    >
                      <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                      <span className="text-slate-500">
                        {new Date(p.recordedAt).toLocaleDateString('en-RW', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                      <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                        RWF {p.amount.toLocaleString()}
                      </span>
                      {p.notes && (
                        <span className="text-slate-400 truncate">{p.notes}</span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Due date note */}
          {account.dueDate && account.status !== 'paid' && (
            <div className={clsx(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
              isOverdue
                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
            )}>
              {isOverdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
              <span>
                {isOverdue ? 'Payment overdue since' : 'Full payment due by'}{' '}
                <strong>{dueDateStr}</strong>
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {account.status !== 'paid' && (
              <button
                className="btn-primary text-xs py-1.5 gap-1.5"
                onClick={(e) => { e.stopPropagation(); setShowPay(true); }}
              >
                <DollarSign size={12} /> Record Payment
              </button>
            )}
            <button
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-primary-50 hover:text-primary-600 transition-colors"
              onClick={(e) => { e.stopPropagation(); onEdit(account); }}
            >
              <Pencil size={11} /> Edit
            </button>
            <button
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
              onClick={(e) => { e.stopPropagation(); onDelete(account); }}
            >
              <Trash2 size={11} /> Delete
            </button>
          </div>
        </div>
      )}

      {showPay && (
        <RecordPaymentModal account={account} onClose={() => setShowPay(false)} />
      )}
    </div>
  );
}

// ── Customer group card ───────────────────────────────────────────────────────

interface CustomerGroup {
  key: string;
  customerName: string;
  customerPhone?: string;
  accounts: CreditAccount[];
}

function CustomerGroupCard({
  group,
  shopName,
  shopPhone,
  onEdit,
  onDelete,
}: {
  group: CustomerGroup;
  shopName: string;
  shopPhone: string;
  onEdit: (a: CreditAccount) => void;
  onDelete: (a: CreditAccount) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showPayAll, setShowPayAll] = useState(false);

  const totalBalance = group.accounts.reduce((s, a) => s + a.balance, 0);
  const totalPaid    = group.accounts.reduce((s, a) => s + a.amountPaid, 0);
  const totalAmount  = group.accounts.reduce((s, a) => s + a.totalAmount, 0);
  const unpaid       = group.accounts.filter((a) => a.status !== 'paid' && a.balance > 0);
  const hasOverdue   = group.accounts.some((a) => a.status === 'overdue');
  const allPaid      = group.accounts.every((a) => a.status === 'paid');
  const activeCount  = unpaid.length;

  return (
    <div className={clsx(
      'card overflow-hidden p-0 border',
      hasOverdue
        ? 'border-red-200 dark:border-red-800/40'
        : allPaid
          ? 'border-green-200 dark:border-green-800/30'
          : 'border-slate-200 dark:border-slate-700',
    )}>
      {/* Customer header */}
      <div
        className={clsx(
          'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
          hasOverdue
            ? 'hover:bg-red-50 dark:hover:bg-red-900/10'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
        )}
        onClick={() => setOpen((p) => !p)}
      >
        <div className={clsx(
          'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold',
          hasOverdue
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : allPaid
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
        )}>
          {group.customerName.slice(0, 2).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {group.customerName}
            </p>
            {hasOverdue && (
              <span className="text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                Overdue
              </span>
            )}
            {allPaid && (
              <span className="text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full">
                All Paid
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {group.customerPhone && (
              <span className="text-[10px] text-slate-400">{group.customerPhone}</span>
            )}
            <span className="text-[10px] text-slate-400">
              {group.accounts.length} credit{group.accounts.length !== 1 ? 's' : ''}
              {activeCount > 0 && ` · ${activeCount} unpaid`}
            </span>
          </div>
          {!allPaid && (
            <PayProgress paid={totalPaid} total={totalAmount} />
          )}
        </div>

        <div className="flex-shrink-0 text-right">
          {totalBalance > 0 ? (
            <>
              <p className="text-base font-bold text-red-600 dark:text-red-400 tabular-nums">
                RWF {totalBalance.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400">outstanding</p>
            </>
          ) : (
            <p className="text-sm font-semibold text-green-600 dark:text-green-400">Settled</p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
          {unpaid.length > 1 && (
            <button
              title="Pay all debts at once"
              onClick={(e) => { e.stopPropagation(); setShowPayAll(true); }}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 transition-colors whitespace-nowrap"
            >
              <Users size={11} /> Pay All
            </button>
          )}
          <span className="text-slate-400">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </div>

      {/* Individual credits */}
      {open && (
        <div>
          {group.accounts.map((acc) => (
            <AccountSubRow
              key={acc._id}
              account={acc}
              shopName={shopName}
              shopPhone={shopPhone}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {showPayAll && (
        <PayAllModal
          customerName={group.customerName}
          accounts={unpaid}
          onClose={() => setShowPayAll(false)}
        />
      )}
    </div>
  );
}

// ── Status filter pills ───────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { label: 'Active', value: 'active' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'All',    value: 'all' },
  { label: 'Paid',   value: 'paid' },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export function CreditsPage() {
  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<CreditAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CreditAccount | null>(null);
  const qc = useQueryClient();

  const shopQ = useQuery({
    queryKey: ['settings', 'shop'],
    queryFn: () => settingsApi.getShop(),
    staleTime: 5 * 60_000,
  });
  const shopName = shopQ.data?.shop?.name ?? 'JUAKALI STORE';
  const shopPhone = shopQ.data?.shop?.phone ?? '';

  const deleteCredit = useMutation({
    mutationFn: (id: string) => creditsApi.delete(id),
    onSuccess: () => {
      toast.success('Credit account deleted');
      qc.invalidateQueries({ queryKey: ['credits'] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['credits', 'list', statusFilter, page, search],
    queryFn: () => creditsApi.list({ page, status: statusFilter, search: search || undefined }),
    staleTime: 15_000,
  });

  const accounts = data?.accounts ?? [];
  const pages    = data?.pages ?? 1;

  const totalBalance  = accounts.reduce((s, a) => s + a.balance, 0);
  const overdueCount  = accounts.filter((a) => a.status === 'overdue').length;

  // Group by customer
  const groups = useMemo<CustomerGroup[]>(() => {
    const map = new Map<string, CustomerGroup>();
    for (const acc of accounts) {
      const key = acc.customerId ?? acc.customerName;
      if (!map.has(key)) {
        map.set(key, {
          key,
          customerName: acc.customerName,
          customerPhone: acc.customerPhone,
          accounts: [],
        });
      }
      map.get(key)!.accounts.push(acc);
    }
    return [...map.values()];
  }, [accounts]);

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Credit Accounts</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {data ? `${data.total} account${data.total !== 1 ? 's' : ''} · ${groups.length} customer${groups.length !== 1 ? 's' : ''}` : '…'}
            {search && <span className="text-primary-500"> · "{search}"</span>}
            {totalBalance > 0 && ` · Outstanding: RWF ${totalBalance.toLocaleString()}`}
            {overdueCount > 0 && (
              <span className="text-red-500 font-medium"> · {overdueCount} overdue</span>
            )}
          </p>
        </div>
        {accounts.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => printTable(accounts, CREDIT_COLS, 'Credit Accounts')} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><Printer size={13} /> Print</button>
            <button onClick={() => exportCSV(accounts, CREDIT_COLS, 'credit-accounts')} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><Download size={13} /> CSV</button>
            <button onClick={() => exportPDF(accounts, CREDIT_COLS, 'Credit Accounts')} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><FileText size={13} /> PDF</button>
          </div>
        )}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden w-fit">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                statusFilter === f.value
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-8 text-sm"
            placeholder="Search by customer or sale #…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : groups.length === 0 ? (
        <div className="card flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
          <CreditCard size={32} className="opacity-30" />
          <p className="text-sm">No credit accounts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <CustomerGroupCard
              key={group.key}
              group={group}
              shopName={shopName}
              shopPhone={shopPhone}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            className="btn-ghost text-xs px-3 py-1"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="text-xs text-slate-500">Page {page} of {pages}</span>
          <button
            className="btn-ghost text-xs px-3 py-1"
            disabled={page === pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {editTarget && <EditCreditModal account={editTarget} onClose={() => setEditTarget(null)} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-xl w-full max-w-sm shadow-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 size={20} className="text-red-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">Delete Credit — {deleteTarget.customerName}?</p>
                <p className="text-xs text-slate-400">This will permanently remove this credit record.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                className="btn-danger flex-1"
                disabled={deleteCredit.isPending}
                onClick={() => deleteCredit.mutate(deleteTarget._id)}
              >
                {deleteCredit.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
