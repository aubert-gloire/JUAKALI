import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  CreditCard, ChevronDown, ChevronUp, Plus, DollarSign,
  X, AlertCircle, CheckCircle2, Clock,
} from 'lucide-react';
import {
  creditsApi,
  type CreditAccount,
  type CreditStatus,
  CREDIT_STATUS_LABELS,
} from '@/lib/creditsApi';
import { clsx } from 'clsx';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<CreditStatus, string> = {
  active:    'bg-blue-100 text-blue-700',
  paid:      'bg-green-100 text-green-700',
  overdue:   'bg-red-100 text-red-700',
  defaulted: 'bg-slate-200 text-slate-600',
};

function StatusBadge({ status }: { status: CreditStatus }) {
  return (
    <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
      {CREDIT_STATUS_LABELS[status]}
    </span>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function PayProgress({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full">
        <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-slate-400 tabular-nums">{pct.toFixed(0)}%</span>
    </div>
  );
}

// ── Add installment modal ─────────────────────────────────────────────────────

const instSchema = z.object({
  dueDate: z.string().min(1, 'Required'),
  amount: z.coerce.number().int().min(1, 'Required'),
  notes: z.string().optional(),
});

function AddInstallmentModal({ account, onClose }: { account: CreditAccount; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(instSchema),
    defaultValues: { dueDate: '', amount: account.balance, notes: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof instSchema>) =>
      creditsApi.addInstallment(account._id, data),
    onSuccess: () => {
      toast.success('Installment added');
      qc.invalidateQueries({ queryKey: ['credits'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Add Installment</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form
          onSubmit={handleSubmit((d) => mutation.mutate(d))}
          className="p-5 space-y-4"
        >
          <div>
            <label className="form-label">Due Date *</label>
            <input type="date" className="input" {...register('dueDate')} />
            {errors.dueDate && <p className="form-error">{errors.dueDate.message}</p>}
          </div>
          <div>
            <label className="form-label">Amount (RWF) *</label>
            <input type="number" min={1} className="input" {...register('amount')} />
            {errors.amount && <p className="form-error">{errors.amount.message}</p>}
          </div>
          <div>
            <label className="form-label">Notes</label>
            <input className="input" placeholder="Optional…" {...register('notes')} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Record payment modal ──────────────────────────────────────────────────────

const paySchema = z.object({
  amount: z.coerce.number().int().min(1, 'Required'),
  notes: z.string().optional(),
});

function RecordPaymentModal({
  account,
  installmentId,
  suggestedAmount,
  onClose,
}: {
  account: CreditAccount;
  installmentId?: string;
  suggestedAmount?: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(paySchema),
    defaultValues: { amount: suggestedAmount ?? account.balance, notes: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof paySchema>) =>
      creditsApi.recordPayment(account._id, { ...data, installmentId }),
    onSuccess: () => {
      toast.success('Payment recorded');
      qc.invalidateQueries({ queryKey: ['credits'] });
      qc.invalidateQueries({ queryKey: ['credits', 'reminders'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Record Payment</h2>
            <p className="text-xs text-slate-400">{account.customerName} · Balance: RWF {account.balance.toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-5 space-y-4">
          <div>
            <label className="form-label">Amount Paid (RWF) *</label>
            <input type="number" min={1} max={account.balance} className="input" {...register('amount')} />
            {errors.amount && <p className="form-error">{errors.amount.message}</p>}
          </div>
          <div>
            <label className="form-label">Notes</label>
            <input className="input" placeholder="e.g. Paid via MoMo…" {...register('notes')} />
          </div>
          <div className="flex justify-end gap-2">
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

// ── Account row ───────────────────────────────────────────────────────────────

function AccountRow({ account }: { account: CreditAccount }) {
  const [open, setOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<{ installmentId?: string; amount?: number } | null>(null);
  const [showAddInst, setShowAddInst] = useState(false);

  const nextInstallment = account.installments
    .filter((i) => i.status !== 'paid')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  const isOverdue = account.status === 'overdue';

  return (
    <>
      <tr
        className={clsx(
          'border-b border-slate-50 dark:border-slate-800 cursor-pointer',
          isOverdue
            ? 'hover:bg-red-50 dark:hover:bg-red-900/10'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
        )}
        onClick={() => setOpen((p) => !p)}
      >
        <td className="px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{account.customerName}</p>
            {account.customerPhone && (
              <p className="text-[10px] text-slate-400">{account.customerPhone}</p>
            )}
          </div>
        </td>
        <td className="px-4 py-3 font-mono text-xs text-slate-500">{account.saleNumber}</td>
        <td className="px-4 py-3 text-right tabular-nums text-sm text-slate-700 dark:text-slate-300">
          {account.totalAmount.toLocaleString()}
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-sm text-slate-700 dark:text-slate-300 hidden sm:table-cell">
          {account.amountPaid.toLocaleString()}
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-sm font-bold text-red-600">
          {account.balance.toLocaleString()}
        </td>
        <td className="px-4 py-3 hidden md:table-cell">
          {nextInstallment ? (
            <div className={clsx('text-xs', isOverdue ? 'text-red-500 font-medium' : 'text-slate-500')}>
              {new Date(nextInstallment.dueDate).toLocaleDateString('en-RW', { day: 'numeric', month: 'short' })}
            </div>
          ) : (
            <span className="text-slate-300 text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3"><StatusBadge status={account.status} /></td>
        <td className="px-4 py-3 text-slate-400">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>

      {open && (
        <tr className="bg-slate-50 dark:bg-slate-800/30">
          <td colSpan={8} className="px-4 pb-4 pt-2">
            {/* Progress */}
            <PayProgress paid={account.amountPaid} total={account.totalAmount} />

            {/* Installments */}
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Payment Schedule
              </p>
              {account.installments.length === 0 ? (
                <p className="text-xs text-slate-400">No installment schedule set yet.</p>
              ) : (
                account.installments.map((inst) => {
                  const isPaid = inst.status === 'paid';
                  const isInstOverdue = inst.status === 'overdue';
                  return (
                    <div
                      key={inst._id}
                      className={clsx(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-xs',
                        isPaid ? 'bg-green-50 dark:bg-green-900/10' : isInstOverdue ? 'bg-red-50 dark:bg-red-900/10' : 'bg-white dark:bg-slate-800',
                      )}
                    >
                      {isPaid ? (
                        <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                      ) : isInstOverdue ? (
                        <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                      ) : (
                        <Clock size={14} className="text-slate-400 flex-shrink-0" />
                      )}
                      <span className={isPaid ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}>
                        Due {new Date(inst.dueDate).toLocaleDateString('en-RW', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="font-semibold tabular-nums">RWF {inst.amount.toLocaleString()}</span>
                      {inst.paidAmount > 0 && inst.paidAmount < inst.amount && (
                        <span className="text-green-600">Paid: {inst.paidAmount.toLocaleString()}</span>
                      )}
                      {inst.notes && <span className="text-slate-400">{inst.notes}</span>}
                      {!isPaid && (
                        <button
                          className="ml-auto text-xs text-primary-600 hover:text-primary-800 font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPayTarget({ installmentId: inst._id, amount: inst.amount - inst.paidAmount });
                          }}
                        >
                          Pay
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Actions */}
            {account.status !== 'paid' && (
              <div className="flex gap-2 mt-3">
                <button
                  className="btn-primary text-xs py-1.5 gap-1.5"
                  onClick={(e) => { e.stopPropagation(); setPayTarget({}); }}
                >
                  <DollarSign size={13} /> Record Payment
                </button>
                <button
                  className="btn-ghost text-xs py-1.5 gap-1.5"
                  onClick={(e) => { e.stopPropagation(); setShowAddInst(true); }}
                >
                  <Plus size={13} /> Add Installment
                </button>
              </div>
            )}
          </td>
        </tr>
      )}

      {payTarget !== null && (
        <RecordPaymentModal
          account={account}
          installmentId={payTarget.installmentId}
          suggestedAmount={payTarget.amount}
          onClose={() => setPayTarget(null)}
        />
      )}
      {showAddInst && (
        <AddInstallmentModal account={account} onClose={() => setShowAddInst(false)} />
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Paid', value: 'paid' },
];

export function CreditsPage() {
  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['credits', 'list', statusFilter, page],
    queryFn: () => creditsApi.list({ page, status: statusFilter }),
    staleTime: 15_000,
  });

  const accounts = data?.accounts ?? [];
  const pages = data?.pages ?? 1;

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Credit Accounts</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {data ? `${data.total} accounts` : '…'}
            {accounts.length > 0 && ` · Outstanding: RWF ${totalBalance.toLocaleString()}`}
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden w-fit mb-4">
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

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
            <CreditCard size={32} className="opacity-30" />
            <p className="text-sm">No credit accounts</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Sale #</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Total</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Paid</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Balance</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden md:table-cell">Next Due</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <AccountRow key={a._id} account={a} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button className="btn-ghost text-xs px-3 py-1" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
          <span className="text-xs text-slate-500">Page {page} of {pages}</span>
          <button className="btn-ghost text-xs px-3 py-1" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
