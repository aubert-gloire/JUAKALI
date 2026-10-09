import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Receipt, ChevronDown, ChevronUp, AlertCircle,
  Banknote, Smartphone, CreditCard, Tag,
} from 'lucide-react';
import { salesApi, type Sale, type PaymentMethod, PAYMENT_LABELS } from '@/lib/salesApi';
import { clsx } from 'clsx';

// ── Badges ────────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<PaymentMethod, string> = {
  cash:         'bg-green-100 text-green-700',
  mobile_money: 'bg-purple-100 text-purple-700',
  card:         'bg-blue-100 text-blue-700',
  credit:       'bg-amber-100 text-amber-700',
};

const METHOD_ICONS: Record<PaymentMethod, React.ElementType> = {
  cash: Banknote, mobile_money: Smartphone, card: CreditCard, credit: Tag,
};

function PaymentBadge({ method }: { method: PaymentMethod }) {
  const Icon = METHOD_ICONS[method];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${METHOD_COLORS[method]}`}>
      <Icon size={10} /> {method === 'mobile_money' ? 'MoMo' : PAYMENT_LABELS[method]}
    </span>
  );
}

function StatusBadge({ status }: { status: 'completed' | 'voided' }) {
  return (
    <span className={clsx(
      'inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
      status === 'completed'
        ? 'bg-green-100 text-green-700'
        : 'bg-red-100 text-red-700',
    )}>
      {status === 'completed' ? 'Completed' : 'Voided'}
    </span>
  );
}

// ── Void modal ────────────────────────────────────────────────────────────────

function VoidModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () => salesApi.void(sale._id, reason),
    onSuccess: () => {
      toast.success(`Sale ${sale.saleNumber} voided`);
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'products'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-xl w-full max-w-sm shadow-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle size={22} className="text-red-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">Void Sale {sale.saleNumber}?</p>
            <p className="text-xs text-slate-400">Stock will be restored.</p>
          </div>
        </div>
        <textarea
          className="input resize-none min-h-[72px] text-sm w-full"
          placeholder="Reason for voiding (required)…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2 mt-3">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn-danger flex-1"
            disabled={!reason.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Voiding…' : 'Void Sale'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sale row ──────────────────────────────────────────────────────────────────

function SaleRow({ sale, onVoid }: { sale: Sale; onVoid: (s: Sale) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
        onClick={() => setOpen((p) => !p)}
      >
        <td className="px-4 py-3 font-mono text-xs text-slate-500">{sale.saleNumber}</td>
        <td className="px-4 py-3 text-xs text-slate-500">
          {new Date(sale.createdAt).toLocaleString('en-RW', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </td>
        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hidden sm:table-cell">
          {sale.customerName ?? <span className="text-slate-300">—</span>}
        </td>
        <td className="px-4 py-3 text-center text-xs text-slate-500 hidden md:table-cell">
          {sale.items.length}
        </td>
        <td className="px-4 py-3">
          <PaymentBadge method={sale.paymentMethod} />
        </td>
        <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
          {sale.total.toLocaleString()}
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={sale.status} />
        </td>
        <td className="px-4 py-3 text-slate-400">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>

      {/* Expanded detail */}
      {open && (
        <tr className="bg-slate-50 dark:bg-slate-800/30">
          <td colSpan={8} className="px-4 pb-3 pt-1">
            <div className="space-y-1.5">
              {sale.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>{item.productName} <span className="text-slate-400">× {item.qty}</span></span>
                  <span className="font-medium tabular-nums">{item.totalPrice.toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1 flex flex-wrap gap-4 text-xs">
                {sale.discountAmount > 0 && (
                  <span className="text-green-600">Discount: −{sale.discountAmount.toLocaleString()}</span>
                )}
                <span className="text-slate-500">Cost: {sale.totalCost.toLocaleString()}</span>
                <span className="text-primary-600 font-medium">Profit: {sale.profit.toLocaleString()}</span>
                {sale.amountTendered != null && (
                  <span className="text-slate-500">Tendered: {sale.amountTendered.toLocaleString()} · Change: {(sale.change ?? 0).toLocaleString()}</span>
                )}
                {sale.status === 'completed' && (
                  <button
                    className="ml-auto text-red-500 hover:text-red-700 font-medium"
                    onClick={(e) => { e.stopPropagation(); onVoid(sale); }}
                  >
                    Void
                  </button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const RANGES = [
  { label: 'Today',     value: 'today' },
  { label: 'This week', value: 'week' },
  { label: 'This month',value: 'month' },
  { label: 'All time',  value: 'all' },
];

function rangeToParams(range: string): { from?: string; to?: string } {
  const now = new Date();
  if (range === 'today') {
    return { from: now.toISOString().slice(0, 10) };
  }
  if (range === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    return { from: d.toISOString().slice(0, 10) };
  }
  if (range === 'month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10) };
  }
  return {};
}

export function SalesHistoryPage() {
  const [range, setRange] = useState('today');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);

  const rangeParams = rangeToParams(range);

  const { data, isLoading } = useQuery({
    queryKey: ['sales', 'list', range, paymentMethod, status, page],
    queryFn: () =>
      salesApi.list({
        page,
        status: status !== 'all' ? status : undefined,
        paymentMethod: paymentMethod !== 'all' ? paymentMethod : undefined,
        ...rangeParams,
      } as Parameters<typeof salesApi.list>[0]),
    staleTime: 15_000,
  });

  const sales = data?.sales ?? [];
  const pages = data?.pages ?? 1;

  const totalRevenue = sales.filter(s => s.status === 'completed').reduce((s, sale) => s + sale.total, 0);

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Sales History</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {data ? `${data.total} records` : '…'}
            {sales.length > 0 && ` · RWF ${totalRevenue.toLocaleString()}`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Date range */}
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => { setRange(r.value); setPage(1); }}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                range === r.value
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Payment method */}
        <select
          className="input text-xs py-1.5 w-auto"
          value={paymentMethod}
          onChange={(e) => { setPaymentMethod(e.target.value); setPage(1); }}
        >
          <option value="all">All methods</option>
          <option value="cash">Cash</option>
          <option value="mobile_money">Mobile Money</option>
          <option value="card">Card</option>
          <option value="credit">Credit</option>
        </select>

        {/* Status */}
        <select
          className="input text-xs py-1.5 w-auto"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="all">All status</option>
          <option value="completed">Completed</option>
          <option value="voided">Voided</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
            <Receipt size={32} className="opacity-30" />
            <p className="text-sm">No sales found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Sale #</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Customer</th>
                <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden md:table-cell">Items</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Method</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Total (RWF)</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <SaleRow key={sale._id} sale={sale} onVoid={setVoidTarget} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button className="btn-ghost text-xs px-3 py-1" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </button>
          <span className="text-xs text-slate-500">Page {page} of {pages}</span>
          <button className="btn-ghost text-xs px-3 py-1" disabled={page === pages} onClick={() => setPage(p => p + 1)}>
            Next
          </button>
        </div>
      )}

      {voidTarget && <VoidModal sale={voidTarget} onClose={() => setVoidTarget(null)} />}
    </div>
  );
}
