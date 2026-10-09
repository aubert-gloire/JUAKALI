import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Package, TrendingUp, DollarSign, ShoppingCart, Wallet } from 'lucide-react';
import { statsApi, type SalesStats, type TrendPoint } from '@/lib/salesApi';
import { clsx } from 'clsx';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProductStats {
  total: number;
  lowStock: number;
  inventoryValue: number;
}

interface LowStockProduct {
  _id: string;
  name: string;
  sku: string;
  stockQty: number;
  reorderLevel: number;
  categoryId?: { name: string; color: string } | null;
}

type RangeKey = 'today' | 'week' | 'month';

// ── Constants ─────────────────────────────────────────────────────────────────

const CHART_ORANGE = '#ea580c';
const CHART_SLATE  = '#64748b';
const RANGE_LABELS: Record<RangeKey, string> = { today: 'Today', week: 'Last 7 days', month: 'This month' };

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
  loading,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        {loading ? (
          <div className="h-6 w-24 bg-slate-100 dark:bg-slate-700 rounded animate-pulse mt-1" />
        ) : (
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">{value}</p>
        )}
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Custom tooltip for charts ─────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-slate-600 dark:text-slate-300 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === 'revenue' ? 'Revenue' : p.name === 'profit' ? 'Profit' : p.name}:{' '}
          <span className="font-bold">RWF {p.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const [range, setRange] = useState<RangeKey>('today');

  const statsQ = useQuery({
    queryKey: ['sales', 'stats', range],
    queryFn: () => statsApi.get(range),
    staleTime: 30_000,
  });

  const trendQ = useQuery({
    queryKey: ['sales', 'trend'],
    queryFn: () => statsApi.trend(),
    staleTime: 60_000,
  });

  const productStatsQ = useQuery({
    queryKey: ['inventory', 'stats'],
    queryFn: () => api.get<ProductStats>('/inventory/products/stats'),
    staleTime: 30_000,
  });

  const lowStockQ = useQuery({
    queryKey: ['inventory', 'lowStock'],
    queryFn: () =>
      api.get<{ products: LowStockProduct[]; total: number }>('/inventory/products?lowStock=true&limit=8'),
    staleTime: 30_000,
  });

  const s: SalesStats | undefined = statsQ.data;
  const pStats = productStatsQ.data;
  const lowStockItems = lowStockQ.data?.products ?? [];
  const trendData: TrendPoint[] = trendQ.data?.trend ?? [];

  const fmt = (n: number) => `RWF ${n.toLocaleString()}`;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {new Date().toLocaleDateString('en-RW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Range selector */}
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                range === r
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
              )}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards — 6 cards, 2-col mobile / 3-col md / 6-col lg */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Revenue"
          value={s ? fmt(s.revenue) : '—'}
          icon={DollarSign}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          sub={RANGE_LABELS[range]}
          loading={statsQ.isLoading}
        />
        <KpiCard
          label="Profit"
          value={s ? fmt(s.profit) : '—'}
          icon={TrendingUp}
          color="bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400"
          sub="Revenue − cost"
          loading={statsQ.isLoading}
        />
        <KpiCard
          label="Expenses"
          value={s ? fmt(s.expenses) : '—'}
          icon={Wallet}
          color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
          sub={RANGE_LABELS[range]}
          loading={statsQ.isLoading}
        />
        <KpiCard
          label="Net Profit"
          value={s ? fmt(s.netProfit) : '—'}
          icon={TrendingUp}
          color={
            (s?.netProfit ?? 0) >= 0
              ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400'
              : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
          }
          sub="Profit − expenses"
          loading={statsQ.isLoading}
        />
        <KpiCard
          label="Transactions"
          value={s?.transactions ?? '—'}
          icon={ShoppingCart}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          sub="Completed sales"
          loading={statsQ.isLoading}
        />
        <KpiCard
          label="Inventory Value"
          value={pStats ? fmt(pStats.inventoryValue) : '—'}
          icon={Package}
          color="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          sub="At cost price"
          loading={productStatsQ.isLoading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* 30-day trend */}
        <div className="lg:col-span-3">
          <SectionCard title="30-Day Revenue & Profit">
            {trendData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-slate-300 dark:text-slate-600">
                <p className="text-sm">No sales data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: CHART_SLATE }}
                    axisLine={false}
                    tickLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: CHART_SLATE }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke={CHART_ORANGE}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    strokeDasharray="4 2"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
            <div className="flex gap-4 mt-2 justify-center">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <div className="w-4 h-0.5 bg-orange-600 rounded" />
                Revenue
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <div className="w-4 h-0.5 bg-emerald-500 rounded" style={{ borderTop: '2px dashed #10b981', background: 'none' }} />
                Profit
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Low stock */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Low Stock Alert"
            action={
              pStats?.lowStock ? (
                <span className="text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                  {pStats.lowStock} item{pStats.lowStock !== 1 ? 's' : ''}
                </span>
              ) : undefined
            }
          >
            {lowStockQ.isLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-5 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
                ))}
              </div>
            ) : lowStockItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                <Package size={32} className="mb-2 opacity-30" />
                <p className="text-sm">
                  {pStats?.total === 0 ? 'No products yet' : 'All stock levels healthy'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {lowStockItems.map((p) => {
                  const pct = p.reorderLevel > 0 ? Math.min(100, (p.stockQty / p.reorderLevel) * 100) : 100;
                  const isOut = p.stockQty === 0;
                  return (
                    <div key={p._id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{p.name}</p>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700">
                          <div
                            className={`h-full rounded-full transition-all ${isOut ? 'bg-red-500' : 'bg-amber-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className={`text-xs font-bold tabular-nums ${isOut ? 'text-red-600' : 'text-amber-600'}`}>
                        {p.stockQty}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Profit vs Expenses bar chart */}
      {trendData.length > 0 && (
        <SectionCard title="Daily Transactions — Last 30 Days">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: CHART_SLATE }}
                axisLine={false}
                tickLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: CHART_SLATE }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={(v: number) => [v, 'Transactions']}
              />
              <Bar dataKey="transactions" fill={CHART_ORANGE} radius={[3, 3, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      )}
    </div>
  );
}
