import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Users, Plus, Phone, Mail, Search, X, Pencil, Trash2, Printer, Download, FileText, FileBarChart2, AlertCircle } from 'lucide-react';
import { customersApi, salesApi, type Customer, type CustomerBody, type Sale } from '@/lib/salesApi';
import { creditsApi, type CreditAccount } from '@/lib/creditsApi';
import { exportCSV, printTable, exportPDF, type ShopInfo } from '@/lib/exportUtils';
import { settingsApi } from '@/lib/settingsApi';

const CUSTOMER_COLS = [
  { label: 'Name',        value: (c: Customer) => c.name },
  { label: 'Phone',       value: (c: Customer) => c.phone ?? '' },
  { label: 'Email',       value: (c: Customer) => c.email ?? '' },
  { label: 'TIN',         value: (c: Customer) => c.tin ?? '' },
  { label: 'Total Spent (RWF)', value: (c: Customer) => c.totalSpent },
  { label: 'Notes',       value: (c: Customer) => c.notes ?? '' },
];

// ── Form schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  tin: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

// ── Customer modal ─────────────────────────────────────────────────────────────

function CustomerModal({
  customer,
  onClose,
}: {
  customer: Customer | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = customer !== null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '', email: '', tin: '', notes: '' },
  });

  useEffect(() => {
    if (customer) {
      reset({ name: customer.name, phone: customer.phone ?? '', email: customer.email ?? '', tin: customer.tin ?? '', notes: customer.notes ?? '' });
    } else {
      reset({ name: '', phone: '', email: '', tin: '', notes: '' });
    }
  }, [customer, reset]);

  const mutation = useMutation({
    mutationFn: (data: CustomerBody) =>
      isEdit
        ? customersApi.update(customer!._id, data)
        : customersApi.create(data),
    onSuccess: () => {
      toast.success(isEdit ? 'Customer updated' : 'Customer added');
      qc.invalidateQueries({ queryKey: ['sales', 'customers'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const onSubmit = (data: FormData) =>
    mutation.mutate({
      name: data.name,
      phone: data.phone || undefined,
      email: data.email || undefined,
      tin: data.tin || undefined,
      notes: data.notes || undefined,
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            {isEdit ? 'Edit Customer' : 'Add Customer'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="form-label">Full Name *</label>
            <input className="input" placeholder="e.g. Aimable Mutoni" {...register('name')} />
            {errors.name && <p className="form-error">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Phone */}
            <div>
              <label className="form-label">Phone</label>
              <input className="input" placeholder="+250 7…" {...register('phone')} />
              {errors.phone && <p className="form-error">{errors.phone.message}</p>}
            </div>
            {/* Email */}
            <div>
              <label className="form-label">Email</label>
              <input className="input" placeholder="email@…" {...register('email')} />
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>
            {/* TIN */}
            <div className="col-span-2">
              <label className="form-label">TIN Number</label>
              <input className="input" placeholder="e.g. 123456789" {...register('tin')} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="form-label">Notes</label>
            <textarea className="input min-h-[64px] resize-none" placeholder="Any notes…" {...register('notes')} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || mutation.isPending} className="btn-primary">
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete confirmation modal ──────────────────────────────────────────────────

function DeleteCustomerModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => customersApi.delete(customer._id),
    onSuccess: () => {
      toast.success('Customer removed');
      qc.invalidateQueries({ queryKey: ['sales', 'customers'] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-xl w-full max-w-sm shadow-2xl p-5">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Remove Customer</h2>
        <p className="text-sm text-slate-500 mb-5">
          Remove <strong>{customer.name}</strong>? This will hide them from the customer list.
          Sales history is preserved.
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-danger"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Statement modal ───────────────────────────────────────────────────────────

function StatementModal({ customer, credits, onClose }: { customer: Customer; credits: CreditAccount[]; onClose: () => void }) {
  const [tab, setTab] = useState<'credits' | 'purchases'>('credits');
  const customerCredits = credits.filter((c) => c.customerId === customer._id);
  const totalDebt = customerCredits.filter(c => c.status !== 'paid').reduce((s, c) => s + c.balance, 0);

  const salesQ = useQuery({
    queryKey: ['sales', 'list', 'by-customer', customer._id],
    queryFn: () => salesApi.list({ customerId: customer._id, page: 1 }),
    staleTime: 30_000,
  });
  const allPurchases: Sale[] = (salesQ.data?.sales ?? []).filter((s) => s.status === 'completed');

  const shopQ = useQuery({ queryKey: ['settings', 'shop'], queryFn: () => settingsApi.getShop(), staleTime: 5 * 60_000 });
  const shop = shopQ.data?.shop;

  const printStatement = () => {
    const w = window.open('', '_blank');
    if (!w) return;

    const salesRows = allPurchases.map((s) => {
      const items = s.items.map((i) => `${i.productName} ×${i.qty}`).join(', ');
      const method = s.paymentMethod === 'mobile_money' ? 'MoMo' : s.paymentMethod === 'credit' ? 'Credit' : 'Cash';
      return `<tr>
        <td>${s.saleNumber}</td>
        <td>${new Date(s.createdAt).toLocaleDateString('en-RW')}</td>
        <td>${items}</td>
        <td style="text-align:right">${s.total.toLocaleString()}</td>
        <td>${method}</td>
      </tr>`;
    }).join('');

    const creditRows = customerCredits.map((c) => `<tr>
      <td>${c.saleNumber}</td>
      <td>${new Date(c.createdAt).toLocaleDateString('en-RW')}</td>
      <td style="text-align:right">${c.totalAmount.toLocaleString()}</td>
      <td style="text-align:right">${c.amountPaid.toLocaleString()}</td>
      <td style="text-align:right;font-weight:bold;color:${c.balance > 0 ? '#dc2626' : '#16a34a'}">${c.balance.toLocaleString()}</td>
      <td style="text-transform:capitalize">${c.status}</td>
    </tr>`).join('');

    const shopMeta = [shop?.location, shop?.phone, shop?.email].filter(Boolean).join(' · ');
    w.document.write(`<!doctype html><html><head><title>Statement — ${customer.name}</title><style>
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#111;max-width:800px;margin:0 auto}
      .shop-name{font-size:16px;font-weight:700;margin:0 0 2px}
      .shop-meta{font-size:11px;color:#555;margin:0 0 2px}
      .shop-tin{font-size:10px;color:#777;margin:0 0 8px}
      .divider{border:none;border-top:1px solid #ccc;margin:8px 0 14px}
      h1{font-size:18px;margin:0 0 2px}
      .subtitle{color:#666;margin:0 0 16px;font-size:12px}
      .summary{display:flex;gap:16px;margin-bottom:20px}
      .box{border:1px solid #ddd;border-radius:6px;padding:10px 14px;flex:1}
      .box-label{font-size:10px;font-weight:600;text-transform:uppercase;color:#888;letter-spacing:.05em;margin-bottom:2px}
      .box-value{font-size:16px;font-weight:700}
      .box-value.debt{color:#dc2626}
      .box-value.ok{color:#16a34a}
      h2{font-size:13px;margin:20px 0 6px;padding-bottom:4px;border-bottom:1px solid #eee}
      table{width:100%;border-collapse:collapse;margin-bottom:8px}
      th{background:#f5f5f5;font-size:10px;text-transform:uppercase;letter-spacing:.04em;font-weight:600;color:#555;padding:6px 8px;text-align:left;border-bottom:2px solid #ddd}
      td{padding:6px 8px;border-bottom:1px solid #f0f0f0;vertical-align:top}
      tr:last-child td{border-bottom:none}
      .empty{color:#aaa;font-style:italic;padding:10px 8px}
      .footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:10px;color:#999;text-align:right}
      @media print{body{padding:10px}}
    </style></head><body>
      ${shop?.name ? `<p class="shop-name">${shop.name}</p>` : ''}
      ${shopMeta ? `<p class="shop-meta">${shopMeta}</p>` : ''}
      ${shop?.tin ? `<p class="shop-tin">TIN: ${shop.tin}</p>` : ''}
      ${shop?.name ? '<hr class="divider">' : ''}
      <h1>Customer Statement</h1>
      <p class="subtitle">${customer.name}${customer.phone ? ' · ' + customer.phone : ''}${customer.email ? ' · ' + customer.email : ''}${customer.tin ? ' · TIN: ' + customer.tin : ''}</p>

      <div class="summary">
        <div class="box">
          <div class="box-label">Total Sales</div>
          <div class="box-value">${allPurchases.length} transaction${allPurchases.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="box">
          <div class="box-label">Total Spent</div>
          <div class="box-value">RWF ${customer.totalSpent.toLocaleString()}</div>
        </div>
        <div class="box">
          <div class="box-label">Outstanding Debt</div>
          <div class="box-value ${totalDebt > 0 ? 'debt' : 'ok'}">RWF ${totalDebt.toLocaleString()}</div>
        </div>
      </div>

      <h2>Sales History</h2>
      <table>
        <thead><tr><th>Sale #</th><th>Date</th><th>Items</th><th style="text-align:right">Total (RWF)</th><th>Payment</th></tr></thead>
        <tbody>${salesRows || '<tr><td colspan="5" class="empty">No sales recorded</td></tr>'}</tbody>
      </table>

      ${customerCredits.length > 0 ? `
      <h2>Credit Accounts</h2>
      <table>
        <thead><tr><th>Sale #</th><th>Date</th><th style="text-align:right">Amount</th><th style="text-align:right">Paid</th><th style="text-align:right">Balance</th><th>Status</th></tr></thead>
        <tbody>${creditRows}</tbody>
      </table>
      <p style="text-align:right;font-weight:700;font-size:13px;margin-top:6px">
        Total outstanding: RWF ${totalDebt.toLocaleString()}
      </p>` : ''}

      <div class="footer">Printed on ${new Date().toLocaleDateString('en-RW', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    <script>window.onload=function(){window.focus();window.print();}<\/script>
    </body></html>`);
    w.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Statement — {customer.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {customer.phone && `${customer.phone}`}
              {customer.email && ` · ${customer.email}`}
              {customer.tin && ` · TIN: ${customer.tin}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={printStatement}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Printer size={12} /> Print
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5">
          {/* Summary row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Total Spent</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">RWF {customer.totalSpent.toLocaleString()}</p>
            </div>
            <div className={`rounded-lg px-4 py-3 ${totalDebt > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Outstanding Debt</p>
              <p className={`text-lg font-bold ${totalDebt > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                RWF {totalDebt.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden mb-3 w-fit">
            <button
              onClick={() => setTab('credits')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${tab === 'credits' ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              Credit Accounts {customerCredits.length > 0 && `(${customerCredits.length})`}
            </button>
            <button
              onClick={() => setTab('purchases')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${tab === 'purchases' ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              All Purchases {allPurchases.length > 0 && `(${allPurchases.length})`}
            </button>
          </div>

          {/* Credit account list */}
          {tab === 'credits' && (customerCredits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
              <AlertCircle size={28} className="opacity-30" />
              <p className="text-sm">No credit sales for this customer</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {customerCredits.map((c) => (
                <div key={c._id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{c.saleNumber}</p>
                    <p className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleDateString('en-RW')}
                      {c.dueDate && ` · due ${new Date(c.dueDate).toLocaleDateString('en-RW')}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">RWF {c.totalAmount.toLocaleString()}</p>
                    {c.balance > 0 ? (
                      <p className="text-[10px] font-bold text-red-500">RWF {c.balance.toLocaleString()} owed</p>
                    ) : (
                      <p className="text-[10px] font-bold text-green-500">Paid</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* All purchases list */}
          {tab === 'purchases' && (salesQ.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            </div>
          ) : allPurchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
              <AlertCircle size={28} className="opacity-30" />
              <p className="text-sm">No purchases found</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {allPurchases.map((s) => (
                <div key={s._id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{s.saleNumber}</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(s.createdAt).toLocaleDateString('en-RW')} · {s.items.length} item{s.items.length !== 1 ? 's' : ''}
                      {s.paymentMethod === 'credit' && <span className="text-amber-500 font-medium"> · Credit</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-primary-600 dark:text-primary-400">RWF {s.total.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400">{s.paymentMethod === 'mobile_money' ? 'MoMo' : s.paymentMethod}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'add' | Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [statementTarget, setStatementTarget] = useState<Customer | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sales', 'customers', search],
    queryFn: () => customersApi.list(search || undefined),
    staleTime: 15_000,
  });

  const shopQ = useQuery({
    queryKey: ['settings', 'shop'],
    queryFn: () => settingsApi.getShop(),
    staleTime: 5 * 60_000,
  });
  const shopInfo: ShopInfo | undefined = shopQ.data?.shop
    ? { name: shopQ.data.shop.name, location: shopQ.data.shop.location, phone: shopQ.data.shop.phone, email: shopQ.data.shop.email, tin: shopQ.data.shop.tin }
    : undefined;

  const creditsQ = useQuery({
    queryKey: ['credits', 'list', 'all-active'],
    queryFn: () => creditsApi.list({ status: 'active' }),
    staleTime: 30_000,
  });
  const activeCredits = creditsQ.data?.accounts ?? [];

  const debtMap = new Map<string, number>();
  for (const c of activeCredits) {
    if (c.customerId) {
      debtMap.set(c.customerId, (debtMap.get(c.customerId) ?? 0) + c.balance);
    }
  }

  const customers = data?.customers ?? [];

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Customers</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {data ? `${customers.length} customers` : '…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {customers.length > 0 && (<>
            <button onClick={() => printTable(customers, CUSTOMER_COLS, 'Customers', shopInfo)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><Printer size={13} /> Print</button>
            <button onClick={() => exportCSV(customers, CUSTOMER_COLS, 'customers')} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><Download size={13} /> CSV</button>
            <button onClick={() => exportPDF(customers, CUSTOMER_COLS, 'Customers', shopInfo)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><FileText size={13} /> PDF</button>
          </>)}
          <button className="btn-primary gap-1.5" onClick={() => setModal('add')}>
            <Plus size={16} /> Add Customer
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Search by name or phone…"
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

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
            <Users size={32} className="opacity-30" />
            <p className="text-sm">{search ? 'No customers match your search' : 'No customers yet'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide hidden sm:table-cell">Contact</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Total Spent</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const debt = debtMap.get(c._id) ?? 0;
                return (
                  <tr key={c._id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {c.name[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-slate-800 dark:text-slate-200">{c.name}</span>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {(c.salesCount ?? 0) > 0 && (
                              <span className="inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                                {c.salesCount} sale{c.salesCount !== 1 ? 's' : ''}
                              </span>
                            )}
                            {debt > 0 && (
                              <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                RWF {debt.toLocaleString()} owed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="space-y-0.5">
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Phone size={11} /> {c.phone}
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Mail size={11} /> {c.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                      RWF {c.totalSpent.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setStatementTarget(c)}
                          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        >
                          <FileBarChart2 size={11} /> Statement
                        </button>
                        <button
                          onClick={() => setModal(c)}
                          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-900/20 dark:hover:text-primary-400 transition-colors"
                        >
                          <Pencil size={11} /> Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        >
                          <Trash2 size={11} /> Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal !== null && (
        <CustomerModal
          customer={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
        />
      )}
      {deleteTarget && (
        <DeleteCustomerModal
          customer={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      {statementTarget && (
        <StatementModal
          customer={statementTarget}
          credits={activeCredits}
          onClose={() => setStatementTarget(null)}
        />
      )}
    </div>
  );
}
