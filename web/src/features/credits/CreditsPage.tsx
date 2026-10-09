import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  CreditCard, ChevronDown, ChevronUp, DollarSign,
  X, Clock, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import {
  creditsApi,
  type CreditAccount,
  type CreditStatus,
} from '@/lib/creditsApi';
import { clsx } from 'clsx';

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
  const { register, handleSubmit, formState: { errors } } = useForm({
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

// ── Account row ───────────────────────────────────────────────────────────────

function AccountRow({ account }: { account: CreditAccount }) {
  const [open, setOpen] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const isOverdue = account.status === 'overdue';

  const dueDateStr = account.dueDate
    ? new Date(account.dueDate).toLocaleDateString('en-RW', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <>
      <tr
        className={clsx(
          'border-b border-slate-50 dark:border-slate-800 cursor-pointer transition-colors',
          isOverdue
            ? 'hover:bg-red-50 dark:hover:bg-red-900/10'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
        )}
        onClick={() => setOpen((p) => !p)}
      >
        {/* Customer */}
        <td className="px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight">
              {account.customerName}
            </p>
            {account.customerPhone && (
              <p className="text-[10px] text-slate-400">{account.customerPhone}</p>
            )}
          </div>
        </td>

        {/* Sale # */}
        <td className="px-4 py-3 font-mono text-xs text-slate-500 hidden sm:table-cell">
          {account.saleNumber}
        </td>

        {/* Total */}
        <td className="px-4 py-3 text-right tabular-nums text-xs text-slate-500 hidden md:table-cell">
          {account.totalAmount.toLocaleString()}
        </td>

        {/* Paid */}
        <td className="px-4 py-3 text-right tabular-nums text-xs text-green-600 dark:text-green-400 hidden md:table-cell">
          {account.amountPaid.toLocaleString()}
        </td>

        {/* Balance */}
        <td className="px-4 py-3 text-right tabular-nums text-sm font-bold text-red-600 dark:text-red-400">
          {account.balance.toLocaleString()}
        </td>

        {/* Due date */}
        <td className="px-4 py-3 hidden lg:table-cell">
          <span className={clsx('text-xs', isOverdue ? 'text-red-500 font-medium' : 'text-slate-500')}>
            {dueDateStr}
          </span>
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <StatusBadge status={account.status} />
        </td>

        {/* Expand */}
        <td className="px-3 py-3 text-slate-400">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>

      {/* ── Expanded detail ── */}
      {open && (
        <tr className="bg-slate-50/60 dark:bg-slate-800/20">
          <td colSpan={8} className="px-4 pb-4 pt-3">
            {/* Progress */}
            <PayProgress paid={account.amountPaid} total={account.totalAmount} />

            {/* Summary row */}
            <div className="grid grid-cols-3 gap-3 mt-3 mb-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                  RWF {account.totalAmount.toLocaleString()}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Paid</p>
                <p className="text-sm font-semibold text-green-600 tabular-nums">
                  RWF {account.amountPaid.toLocaleString()}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Balance</p>
                <p className="text-sm font-semibold text-red-600 tabular-nums">
                  RWF {account.balance.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Payment history */}
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Payment History
            </p>
            {account.payments.length === 0 ? (
              <p className="text-xs text-slate-400 pl-1">No payments recorded yet.</p>
            ) : (
              <div className="space-y-1.5">
                {account.payments
                  .slice()
                  .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
                  .map((p) => (
                    <div
                      key={p._id}
                      className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-xs"
                    >
                      <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
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

            {/* Due date note */}
            {account.dueDate && account.status !== 'paid' && (
              <div className={clsx(
                'flex items-center gap-2 mt-3 rounded-lg px-3 py-2 text-xs',
                isOverdue
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
              )}>
                {isOverdue ? <AlertTriangle size={13} /> : <Clock size={13} />}
                <span>
                  {isOverdue ? 'Payment overdue since' : 'Full payment due by'}{' '}
                  <strong>{dueDateStr}</strong>
                </span>
              </div>
            )}

            {/* Action */}
            {account.status !== 'paid' && (
              <div className="mt-3">
                <button
                  className="btn-primary text-xs py-1.5 gap-1.5"
                  onClick={(e) => { e.stopPropagation(); setShowPay(true); }}
                >
                  <DollarSign size={13} /> Record Payment
                </button>
              </div>
            )}
          </td>
        </tr>
      )}

      {showPay && (
        <RecordPaymentModal account={account} onClose={() => setShowPay(false)} />
      )}
    </>
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

  const { data, isLoading } = useQuery({
    queryKey: ['credits', 'list', statusFilter, page],
    queryFn: () => creditsApi.list({ page, status: statusFilter }),
    staleTime: 15_000,
  });

  const accounts = data?.accounts ?? [];
  const pages    = data?.pages ?? 1;

  const totalBalance  = accounts.reduce((s, a) => s + a.balance, 0);
  const overdueCount  = accounts.filter((a) => a.status === 'overdue').length;

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Credit Accounts</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {data ? `${data.total} accounts` : '…'}
            {totalBalance > 0 && ` · Outstanding: RWF ${totalBalance.toLocaleString()}`}
            {overdueCount > 0 && (
              <span className="text-red-500 font-medium"> · {overdueCount} overdue</span>
            )}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Sale #</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden md:table-cell">Total</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden md:table-cell">Paid</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Balance</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden lg:table-cell">Due Date</th>
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
          </div>
        )}
      </div>

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
    </div>
  );
}
