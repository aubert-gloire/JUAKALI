import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Receipt, ChevronDown, ChevronUp, AlertCircle,
  Banknote, Smartphone, CreditCard, Tag, Search, X, Phone, Pencil,
  Printer, Download, FileText, MessageCircle, Link, TrendingUp,
  CheckCircle2, Clock, DollarSign,
} from 'lucide-react';
import { salesApi, type Sale, type PaymentMethod, PAYMENT_LABELS } from '@/lib/salesApi';
import { settingsApi } from '@/lib/settingsApi';
import { creditsApi, type CreditAccount } from '@/lib/creditsApi';
import { exportPDF, type ShopInfo } from '@/lib/exportUtils';

const SALE_COLS = [
  { label: 'Sale #',      value: (s: Sale) => s.saleNumber },
  { label: 'Date',        value: (s: Sale) => new Date(s.createdAt).toLocaleString('en-RW', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) },
  { label: 'Customer',    value: (s: Sale) => s.customerName ?? '' },
  { label: 'Payment',     value: (s: Sale) => s.paymentMethod === 'mobile_money' ? 'MoMo' : s.paymentMethod },
  { label: 'Items',       value: (s: Sale) => s.items.length },
  { label: 'Total (RWF)', value: (s: Sale) => s.total },
  { label: 'Profit',      value: (s: Sale) => s.profit },
  { label: 'Status',      value: (s: Sale) => s.status === 'voided' ? 'Deleted' : 'Completed' },
];
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
      {status === 'completed' ? 'Completed' : 'Deleted'}
    </span>
  );
}

// ── Export helpers ────────────────────────────────────────────────────────────

function exportCSV(sales: Sale[]) {
  const header = ['Sale #', 'Date', 'Customer', 'Payment', 'Items', 'Subtotal', 'Discount', 'Total (RWF)', 'Cost', 'Profit', 'Status'];
  const rows = sales.map((s) => [
    s.saleNumber,
    new Date(s.createdAt).toLocaleString('en-RW'),
    s.customerName ?? '',
    s.paymentMethod,
    s.items.length,
    s.subtotal,
    s.discountAmount,
    s.total,
    s.totalCost,
    s.profit,
    s.status === 'voided' ? 'Deleted' : 'Completed',
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sales-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printSales(sales: Sale[], shop?: ShopInfo) {
  const rows = sales.map((s) => `
    <tr>
      <td>${s.saleNumber}</td>
      <td>${new Date(s.createdAt).toLocaleString('en-RW', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
      <td>${s.customerName ?? '—'}</td>
      <td>${s.paymentMethod === 'mobile_money' ? 'MoMo' : s.paymentMethod}</td>
      <td style="text-align:right">${s.total.toLocaleString()}</td>
      <td>${s.status === 'voided' ? 'Deleted' : 'Completed'}</td>
    </tr>`).join('');

  let shopHeader = '';
  if (shop) {
    const meta: string[] = [];
    if (shop.location) meta.push(shop.location);
    if (shop.phone) meta.push(shop.phone);
    if (shop.email) meta.push(shop.email);
    if (shop.tin) meta.push(`TIN: ${shop.tin}`);
    shopHeader = `<div class="shop-header"><strong>${shop.name}</strong>${meta.length ? `<span>${meta.join(' · ')}</span>` : ''}</div><hr/>`;
  }

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>Sales Report</title><style>
    body{font-family:sans-serif;font-size:12px;padding:20px}
    .shop-header{margin-bottom:4px}
    .shop-header strong{font-size:15px;display:block}
    .shop-header span{font-size:11px;color:#666}
    hr{border:none;border-top:1px solid #ccc;margin:6px 0 12px}
    h2{margin-bottom:4px}p{margin:0 0 12px;color:#555}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
    th{background:#f5f5f5;font-weight:600}
    tr:nth-child(even){background:#fafafa}
    @media print{body{padding:0}}
  </style></head><body>
    ${shopHeader}
    <h2>Sales Report</h2>
    <p>Exported ${new Date().toLocaleString('en-RW')} · ${sales.length} records</p>
    <table><thead><tr><th>Sale #</th><th>Date</th><th>Customer</th><th>Payment</th><th style="text-align:right">Total (RWF)</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody></table>
  <script>window.onload=function(){window.focus();window.print();}<\/script>
  </body></html>`);
  w.document.close();
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditSaleModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const qc = useQueryClient();
  const [customerName, setCustomerName] = useState(sale.customerName ?? '');
  const [customerPhone, setCustomerPhone] = useState(sale.customerPhone ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(sale.paymentMethod);
  const [notes, setNotes] = useState(sale.notes ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      salesApi.update(sale._id, {
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        paymentMethod,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(`Sale ${sale.saleNumber} updated`);
      qc.invalidateQueries({ queryKey: ['sales'] });
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
            <p className="font-semibold text-slate-900 dark:text-slate-100">Edit Sale {sale.saleNumber}</p>
            <p className="text-xs text-slate-400">Items and amounts cannot be changed — delete and re-record if needed.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label text-xs">Customer name</label>
            <input
              className="input w-full mt-1 text-sm"
              placeholder="Walk-in customer"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Customer phone</label>
            <input
              className="input w-full mt-1 text-sm"
              placeholder="+250 7XX XXX XXX"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Payment method</label>
            <select
              className="input w-full mt-1 text-sm"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            >
              <option value="cash">Cash</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="card">Card</option>
              <option value="credit">Credit</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Notes</label>
            <textarea
              className="input resize-none text-sm w-full mt-1 min-h-[60px]"
              placeholder="Optional note…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary flex-1"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Void modal ────────────────────────────────────────────────────────────────

function VoidModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () => salesApi.void(sale._id, reason),
    onSuccess: () => {
      toast.success(`Sale ${sale.saleNumber} deleted`);
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
            <p className="font-semibold text-slate-900 dark:text-slate-100">Delete Sale {sale.saleNumber}?</p>
            <p className="text-xs text-slate-400">Stock will be restored automatically.</p>
          </div>
        </div>
        <textarea
          className="input resize-none min-h-[72px] text-sm w-full"
          placeholder="Reason for deleting (required)…"
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
            {mutation.isPending ? 'Deleting…' : 'Delete Sale'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Resend receipt helpers ────────────────────────────────────────────────────

function reshareWhatsApp(sale: Sale, shopName: string, shopPhone: string) {
  const d = '─────────────────────';
  const dateStr = new Date(sale.createdAt).toLocaleString('en-RW', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const lines = [
    `🧾 *${shopName}*`,
    shopPhone ? `📞 ${shopPhone}` : '',
    d,
    `*Receipt #${sale.saleNumber}*`,
    `📅 ${dateStr}`,
    d,
    ...sale.items.map(
      (i) => `▪ ${i.productName}\n   ${i.qty} × RWF ${i.unitPrice.toLocaleString()} = *RWF ${i.totalPrice.toLocaleString()}*`
    ),
    d,
    sale.discountAmount > 0 ? `Subtotal:   RWF ${sale.subtotal.toLocaleString()}` : '',
    sale.discountAmount > 0 ? `Discount:  −RWF ${sale.discountAmount.toLocaleString()}` : '',
    `💰 *TOTAL:  RWF ${sale.total.toLocaleString()}*`,
    d,
    `Payment:   ${PAYMENT_LABELS[sale.paymentMethod]}`,
    sale.customerName ? `\n👤 ${sale.customerName}${sale.customerPhone ? `  |  ${sale.customerPhone}` : ''}` : '',
    d,
    `🙏 Thank you for your business!`,
    sale.receiptUrl ? `\n🔗 View receipt: ${sale.receiptUrl}` : '',
  ].filter(Boolean).join('\n');

  const waTarget = sale.customerPhone
    ? `https://wa.me/${sale.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(lines)}`
    : `https://wa.me/?text=${encodeURIComponent(lines)}`;
  window.open(waTarget, '_blank');
}

// ── Quick pay modal (debtors tab) ─────────────────────────────────────────────

function QuickPayModal({ account, onClose }: { account: CreditAccount; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(account.balance));
  const [notes, setNotes] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      creditsApi.recordPayment(account._id, { amount: parseInt(amount), notes: notes || undefined }),
    onSuccess: () => {
      toast.success('Payment recorded');
      qc.invalidateQueries({ queryKey: ['credits'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
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
            <p className="font-semibold text-slate-900 dark:text-slate-100">Record Payment</p>
            <p className="text-xs text-slate-400 mt-0.5">{account.customerName} · Balance: RWF {account.balance.toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="label text-xs">Amount Paid (RWF) *</label>
            <input
              type="number"
              min={1}
              max={account.balance}
              className="input mt-1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Notes</label>
            <input className="input mt-1" placeholder="e.g. Paid via MoMo…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button
              className="btn-primary"
              disabled={!parseInt(amount) || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sale row ──────────────────────────────────────────────────────────────────

function SaleRow({
  sale, onVoid, onEdit, shopName, shopPhone, creditAccount,
}: {
  sale: Sale;
  onVoid: (s: Sale) => void;
  onEdit: (s: Sale) => void;
  shopName: string;
  shopPhone: string;
  creditAccount?: CreditAccount;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQuickPay, setShowQuickPay] = useState(false);

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
      {showQuickPay && creditAccount && (
        <QuickPayModal account={creditAccount} onClose={() => setShowQuickPay(false)} />
      )}

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
              <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1 flex flex-wrap gap-4 text-xs items-center">
                {sale.discountAmount > 0 && (
                  <span className="text-green-600">Discount: −{sale.discountAmount.toLocaleString()}</span>
                )}
                <span className="text-slate-500">Cost: {sale.totalCost.toLocaleString()}</span>
                <span className="text-primary-600 font-medium">Profit: {sale.profit.toLocaleString()}</span>
                {sale.amountTendered != null && (
                  <span className="text-slate-500">Tendered: {sale.amountTendered.toLocaleString()} · Change: {(sale.change ?? 0).toLocaleString()}</span>
                )}
                {sale.customerPhone && (
                  <a
                    href={`https://wa.me/${sale.customerPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-green-600 hover:text-green-700 font-medium"
                    title={`WhatsApp ${sale.customerPhone}`}
                  >
                    <Phone size={11} />
                    {sale.customerPhone}
                  </a>
                )}
                {sale.status === 'completed' && (
                  <div className="ml-auto flex items-center gap-2 flex-wrap">
                    {creditAccount && creditAccount.status !== 'paid' && (
                      <button
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 font-medium transition-colors"
                        onClick={(e) => { e.stopPropagation(); setShowQuickPay(true); }}
                      >
                        <DollarSign size={11} /> Collect
                      </button>
                    )}
                    <button
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 font-medium transition-colors"
                      onClick={(e) => { e.stopPropagation(); reshareWhatsApp(sale, shopName, shopPhone); }}
                      title="Resend via WhatsApp"
                    >
                      <MessageCircle size={11} /> WhatsApp
                    </button>
                    {sale.receiptUrl && (
                      <button
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 font-medium transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(sale.receiptUrl!).then(() => {
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          });
                        }}
                        title="Copy receipt link"
                      >
                        <Link size={11} /> {copied ? 'Copied!' : 'Copy Link'}
                      </button>
                    )}
                    <button
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-900/20 dark:hover:text-primary-400 font-medium transition-colors"
                      onClick={(e) => { e.stopPropagation(); onEdit(sale); }}
                    >
                      <Pencil size={11} /> Edit
                    </button>
                    <button
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 font-medium transition-colors"
                      onClick={(e) => { e.stopPropagation(); onVoid(sale); }}
                    >
                      Delete
                    </button>
                  </div>
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
  const [debtorsOnly, setDebtorsOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);
  const [editTarget, setEditTarget] = useState<Sale | null>(null);

  const rangeParams = rangeToParams(range);

  const { data, isLoading } = useQuery({
    queryKey: ['sales', 'list', range, paymentMethod, status, debtorsOnly, page],
    queryFn: () =>
      salesApi.list({
        page,
        status: status !== 'all' ? status : undefined,
        paymentMethod: debtorsOnly ? 'credit' : (paymentMethod !== 'all' ? paymentMethod : undefined),
        ...rangeParams,
      } as Parameters<typeof salesApi.list>[0]),
    staleTime: 15_000,
  });

  const shopQ = useQuery({
    queryKey: ['settings', 'shop'],
    queryFn: () => settingsApi.getShop(),
    staleTime: 5 * 60_000,
  });
  const shopName = shopQ.data?.shop?.name ?? 'JUAKALI STORE';
  const shopPhone = shopQ.data?.shop?.phone ?? '';
  const shopInfo: ShopInfo | undefined = shopQ.data?.shop
    ? {
        name: shopQ.data.shop.name,
        location: shopQ.data.shop.location,
        phone: shopQ.data.shop.phone,
        email: shopQ.data.shop.email,
        tin: shopQ.data.shop.tin,
      }
    : undefined;

  const creditsQ = useQuery({
    queryKey: ['credits', 'list', 'active'],
    queryFn: () => creditsApi.list({ status: 'active' }),
    staleTime: 30_000,
  });
  const outstandingDebt = (creditsQ.data?.accounts ?? []).reduce((s, a) => s + a.balance, 0);

  const allSales = data?.sales ?? [];
  const pages = data?.pages ?? 1;

  const creditsBySaleId = new Map<string, CreditAccount>();
  for (const a of creditsQ.data?.accounts ?? []) {
    creditsBySaleId.set(a.saleId, a);
  }

  const q = search.trim().toLowerCase();
  const sales = q
    ? allSales.filter(
        (s) =>
          s.saleNumber.toLowerCase().includes(q) ||
          (s.customerName?.toLowerCase().includes(q) ?? false) ||
          (s.customerPhone?.includes(q) ?? false) ||
          s.items.some((i) => i.productName.toLowerCase().includes(q)),
      )
    : allSales;

  const completedSales = sales.filter(s => s.status === 'completed');
  const creditSales = completedSales.filter(s => s.paymentMethod === 'credit');
  const totalRevenue = completedSales.reduce((s, sale) => s + sale.total, 0);
  const avgOrder = completedSales.length > 0 ? Math.round(totalRevenue / completedSales.length) : 0;

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Sales History</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {data ? `${data.total} records` : '…'}
          </p>
        </div>
        {sales.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => printSales(sales, shopInfo)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Printer size={13} /> Print
            </button>
            <button
              onClick={() => exportCSV(sales)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Download size={13} /> CSV
            </button>
            <button
              onClick={() => exportPDF(sales, SALE_COLS, 'Sales Report', shopInfo)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <FileText size={13} /> PDF
            </button>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-primary-500" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Revenue</p>
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {totalRevenue.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400">RWF</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-green-500" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Completed</p>
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {completedSales.length}
          </p>
          <p className="text-[10px] text-slate-400">sales</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-amber-500" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Credit</p>
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {creditSales.length}
          </p>
          <p className="text-[10px] text-slate-400">sales on credit</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={14} className="text-red-500" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Outstanding</p>
          </div>
          <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">
            {outstandingDebt.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400">RWF owed</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-blue-500" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Avg Order</p>
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {avgOrder.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400">RWF</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9 pr-8 py-2 text-sm w-full"
          placeholder="Search by sale #, customer, phone, or product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {/* Debtors quick tab */}
        <button
          onClick={() => { setDebtorsOnly((p) => !p); setPaymentMethod('all'); setPage(1); }}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
            debtorsOnly
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-300',
          )}
        >
          <CreditCard size={12} />
          Debtors
          {outstandingDebt > 0 && !debtorsOnly && (
            <span className="ml-1 text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
              {creditsQ.data?.accounts?.length ?? ''}
            </span>
          )}
        </button>

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

        {/* Payment method — hidden when debtors tab active */}
        {!debtorsOnly && (
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
        )}

        {/* Status */}
        <select
          className="input text-xs py-1.5 w-auto"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="all">All status</option>
          <option value="completed">Completed</option>
          <option value="voided">Deleted</option>
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
            <p className="text-sm">{debtorsOnly ? 'No credit sales in this period' : 'No sales found'}</p>
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
                <SaleRow
                  key={sale._id}
                  sale={sale}
                  onVoid={setVoidTarget}
                  onEdit={setEditTarget}
                  shopName={shopName}
                  shopPhone={shopPhone}
                  creditAccount={debtorsOnly ? creditsBySaleId.get(sale._id) : undefined}
                />
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

      {editTarget && <EditSaleModal sale={editTarget} onClose={() => setEditTarget(null)} />}
      {voidTarget && <VoidModal sale={voidTarget} onClose={() => setVoidTarget(null)} />}
    </div>
  );
}
