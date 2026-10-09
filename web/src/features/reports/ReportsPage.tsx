import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Package, AlertTriangle, CreditCard,
} from 'lucide-react';
import { reportsApi, type Period, type PeriodParams } from '@/lib/reportsApi';
import { clsx } from 'clsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-RW');
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k';
  return String(n);
}

const PERIOD_OPTIONS: { label: string; value: Period | 'custom' }[] = [
  { label: 'Today', value: 'today' },
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
  { label: 'This year', value: 'year' },
];

const PAYMENT_COLORS: Record<string, string> = {
  cash: '#22c55e',
  mobile_money: '#a855f7',
  card: '#3b82f6',
  credit: '#f59e0b',
};

const CATEGORY_COLORS = ['#ea580c', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#14b8a6'];

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, positive = true, accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  positive?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={clsx('card p-4', accent && 'ring-1 ring-primary-500/30')}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <div className={clsx('p-1.5 rounded-lg', accent ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-slate-100 dark:bg-slate-800')}>
          <Icon size={14} className={accent ? 'text-primary-600' : 'text-slate-500'} />
        </div>
      </div>
      <p className={clsx('text-2xl font-bold tabular-nums', positive ? 'text-slate-900 dark:text-slate-100' : 'text-red-600')}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ params }: { params: PeriodParams }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'overview', params],
    queryFn: () => reportsApi.overview(params),
    staleTime: 60_000,
  });

  if (isLoading) return <LoadingSpinner />;
  if (!data) return null;

  const pmLabels: Record<string, string> = {
    cash: 'Cash', mobile_money: 'MoMo', card: 'Card', credit: 'Credit',
  };

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Revenue" value={`${fmtShort(data.revenue)} RWF`} sub={`${data.transactions} sales`} icon={DollarSign} accent />
        <KpiCard label="Gross Profit" value={`${fmtShort(data.grossProfit)} RWF`} sub={`${data.grossMargin}% margin`} icon={TrendingUp} positive={data.grossProfit >= 0} />
        <KpiCard label="Expenses" value={`${fmtShort(data.expenses)} RWF`} icon={TrendingDown} positive />
        <KpiCard label="Net Profit" value={`${fmtShort(data.netProfit)} RWF`} icon={TrendingUp} positive={data.netProfit >= 0} />
        <KpiCard label="Avg Sale" value={`${fmtShort(data.avgSaleValue)} RWF`} icon={ShoppingCart} />
        <KpiCard label="Discounts Given" value={`${fmtShort(data.totalDiscount)} RWF`} icon={CreditCard} />
      </div>

      {/* P&L table */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Profit & Loss Summary</h3>
        <div className="space-y-2">
          {[
            { label: 'Revenue', value: data.revenue, bold: false },
            { label: 'Cost of Goods Sold', value: -data.cost, bold: false },
            { label: 'Gross Profit', value: data.grossProfit, bold: true },
            { label: 'Operating Expenses', value: -data.expenses, bold: false },
            { label: 'Net Profit', value: data.netProfit, bold: true, accent: true },
          ].map((row) => (
            <div
              key={row.label}
              className={clsx(
                'flex justify-between items-center py-2',
                row.bold && 'border-t border-slate-100 dark:border-slate-700',
              )}
            >
              <span className={clsx('text-sm', row.bold ? 'font-semibold text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400')}>
                {row.label}
              </span>
              <span className={clsx(
                'font-mono text-sm font-semibold tabular-nums',
                row.accent
                  ? row.value >= 0 ? 'text-green-600' : 'text-red-600'
                  : row.value < 0 ? 'text-slate-500' : 'text-slate-800 dark:text-slate-200',
              )}>
                {row.value < 0 ? `(${fmt(Math.abs(row.value))})` : fmt(row.value)} RWF
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Daily trend chart */}
        {data.dailyTrend.length > 1 && (
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Revenue vs Profit Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.dailyTrend} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="_id" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtShort} />
                <Tooltip formatter={(v: number) => [`${fmt(v)} RWF`, '']} labelFormatter={(l) => `Date: ${l}`} />
                <Legend iconType="plainline" iconSize={12} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="revenue" stroke="#ea580c" name="Revenue" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="profit" stroke="#22c55e" name="Profit" dot={false} strokeWidth={2} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Payment method breakdown */}
        {data.paymentBreakdown.length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Sales by Payment Method</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.paymentBreakdown} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="_id" tick={{ fontSize: 10 }} tickFormatter={(v) => pmLabels[v] ?? v} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtShort} />
                <Tooltip formatter={(v: number) => [`${fmt(v)} RWF`, 'Total']} labelFormatter={(l) => pmLabels[l] ?? l} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {data.paymentBreakdown.map((entry, i) => (
                    <Cell key={i} fill={PAYMENT_COLORS[entry._id] ?? '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Products Tab ──────────────────────────────────────────────────────────────

function ProductsTab({ params }: { params: PeriodParams }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'products', params],
    queryFn: () => reportsApi.products(params),
    staleTime: 60_000,
  });

  if (isLoading) return <LoadingSpinner />;
  if (!data) return null;

  const snap = data.stockSnapshot;

  return (
    <div className="space-y-6">
      {/* Stock snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Active Products" value={fmt(snap.totalProducts)} icon={Package} />
        <KpiCard label="Out of Stock" value={fmt(snap.outOfStock)} icon={AlertTriangle} positive={snap.outOfStock === 0} />
        <KpiCard label="Low Stock" value={fmt(snap.lowStock)} icon={AlertTriangle} positive={snap.lowStock === 0} />
        <KpiCard label="Inventory Value" value={`${fmtShort(snap.inventoryValueRetail)} RWF`} sub="at selling price" icon={DollarSign} accent />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top by revenue */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Top by Revenue</h3>
          <div className="space-y-2">
            {data.topByRevenue.map((p, i) => {
              const margin = p.revenue > 0 ? Math.round((p.profit / p.revenue) * 100) : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-4 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{p._id.name}</p>
                    <p className="text-[10px] text-slate-400">{p._id.sku} · ×{p.qty} sold · {margin}% margin</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                    {fmtShort(p.revenue)}
                  </span>
                </div>
              );
            })}
            {data.topByRevenue.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No sales yet</p>}
          </div>
        </div>

        {/* Top by qty */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Top by Units Sold</h3>
          <div className="space-y-2">
            {data.topByQty.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-4 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{p._id.name}</p>
                  <p className="text-[10px] text-slate-400">{p._id.sku}</p>
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                  ×{p.qty}
                </span>
              </div>
            ))}
            {data.topByQty.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No sales yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Customers Tab ─────────────────────────────────────────────────────────────

function CustomersTab({ params }: { params: PeriodParams }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'customers', params],
    queryFn: () => reportsApi.customers(params),
    staleTime: 60_000,
  });

  if (isLoading) return <LoadingSpinner />;
  if (!data) return null;

  const agingOrder = ['0-30', '31-60', '61-90', '90+'];
  const agingMap = Object.fromEntries(data.creditAging.map((a) => [a._id, a]));

  return (
    <div className="space-y-6">
      {/* Top customers */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Top Customers by Spend</h3>
        {data.topCustomers.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No customer data for this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">#</th>
                  <th className="text-left pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">Customer</th>
                  <th className="text-right pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">Purchases</th>
                  <th className="text-right pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">Total Spent</th>
                  <th className="text-right pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">Avg Sale</th>
                </tr>
              </thead>
              <tbody>
                {data.topCustomers.map((c, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="py-2 pr-3 text-xs text-slate-400">{i + 1}</td>
                    <td className="py-2 font-medium text-slate-700 dark:text-slate-300">{c._id.name ?? 'Walk-in'}</td>
                    <td className="py-2 text-right text-xs text-slate-500">{c.transactions}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                      {fmt(c.totalSpent)} RWF
                    </td>
                    <td className="py-2 text-right text-xs text-slate-500 tabular-nums">
                      {fmt(Math.round(c.avgSale))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Credit aging */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Credit Aging</h3>
        <p className="text-xs text-slate-400 mb-4">Outstanding balances grouped by days since sale</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {agingOrder.map((bucket) => {
            const item = agingMap[bucket];
            const isOld = bucket === '61-90' || bucket === '90+';
            return (
              <div key={bucket} className={clsx('rounded-xl p-4 border', isOld && (item?.balance ?? 0) > 0 ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30')}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{bucket} days</p>
                <p className={clsx('text-xl font-bold tabular-nums mt-1', isOld && (item?.balance ?? 0) > 0 ? 'text-red-600' : 'text-slate-800 dark:text-slate-200')}>
                  {fmtShort(item?.balance ?? 0)}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{item?.count ?? 0} accounts</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Expenses Tab ──────────────────────────────────────────────────────────────

function ExpensesTab({ params }: { params: PeriodParams }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'expenses', params],
    queryFn: () => reportsApi.expenses(params),
    staleTime: 60_000,
  });

  if (isLoading) return <LoadingSpinner />;
  if (!data) return null;

  const chartData = data.byCategory.map((c) => ({
    name: c._id,
    value: c.total,
    pct: data.grandTotal > 0 ? Math.round((c.total / data.grandTotal) * 100) : 0,
  }));

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Pie chart */}
        {chartData.length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">By Category</h3>
            <p className="text-xs text-slate-400 mb-4">Total: {fmt(data.grandTotal)} RWF</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, pct }) => `${name} ${pct}%`} labelLine={false}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${fmt(v)} RWF`, '']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category table */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Category Breakdown</h3>
          {data.byCategory.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No expenses for this period</p>
          ) : (
            <div className="space-y-3">
              {data.byCategory.map((c, i) => {
                const pct = data.grandTotal > 0 ? (c.total / data.grandTotal) * 100 : 0;
                return (
                  <div key={c._id}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{c._id}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{fmt(c.total)}</span>
                        <span className="text-[10px] text-slate-400 ml-1">({Math.round(pct)}%)</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Loading spinner ───────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'products', label: 'Products' },
  { id: 'customers', label: 'Customers' },
  { id: 'expenses', label: 'Expenses' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function ReportsPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [tab, setTab] = useState<TabId>('overview');

  const params: PeriodParams = { period };

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Reports</h1>
          <p className="text-xs text-slate-400 mt-0.5">Business analytics and performance insights</p>
        </div>

        {/* Period picker */}
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value as Period)}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                period === opt.value
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab params={params} />}
      {tab === 'products' && <ProductsTab params={params} />}
      {tab === 'customers' && <CustomersTab params={params} />}
      {tab === 'expenses' && <ExpensesTab params={params} />}
    </div>
  );
}
