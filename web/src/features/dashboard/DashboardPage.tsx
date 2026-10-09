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
  Cell,
} from 'recharts';
import { Package, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useProductStats() {
  return useQuery({
    queryKey: ['inventory', 'stats'],
    queryFn: () => api.get<ProductStats>('/inventory/products/stats'),
    staleTime: 30_000,
  });
}

function useLowStockProducts() {
  return useQuery({
    queryKey: ['inventory', 'lowStock'],
    queryFn: () =>
      api.get<{ products: LowStockProduct[]; total: number }>('/inventory/products?lowStock=true&limit=8'),
    staleTime: 30_000,
  });
}

// Placeholder sales data until Phase 3
const SALES_PLACEHOLDER = [
  { day: 'Mon', sales: 0 },
  { day: 'Tue', sales: 0 },
  { day: 'Wed', sales: 0 },
  { day: 'Thu', sales: 0 },
  { day: 'Fri', sales: 0 },
  { day: 'Sat', sales: 0 },
  { day: 'Sun', sales: 0 },
];

const CHART_ORANGE = '#ea580c';
const CHART_SLATE  = '#64748b';

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">{title}</h2>
      {children}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const stats = useProductStats();
  const lowStockQ = useLowStockProducts();

  const fmt = (n: number) => `RWF ${n.toLocaleString()}`;
  const statsData = stats.data;
  const lowStockItems = lowStockQ.data?.products ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {new Date().toLocaleDateString('en-RW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Today's Sales"
          value="RWF 0"
          icon={DollarSign}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          sub="Phase 3 coming soon"
        />
        <KpiCard
          label="Inventory Value"
          value={statsData ? fmt(statsData.inventoryValue) : '—'}
          icon={TrendingUp}
          color="bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400"
          sub="At cost price"
        />
        <KpiCard
          label="Total Products"
          value={statsData?.total ?? '—'}
          icon={Package}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          sub="Active SKUs"
        />
        <KpiCard
          label="Low Stock"
          value={statsData?.lowStock ?? '—'}
          icon={AlertTriangle}
          color={
            (statsData?.lowStock ?? 0) > 0
              ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
          }
          sub="Below reorder level"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Sales trend */}
        <SectionCard title="Sales — Last 7 Days">
          <div className="lg:col-span-3">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={SALES_PLACEHOLDER} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: CHART_SLATE }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: CHART_SLATE }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v: number) => [`RWF ${v.toLocaleString()}`, 'Sales']}
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke={CHART_ORANGE}
                  strokeWidth={2}
                  dot={{ fill: CHART_ORANGE, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-center text-xs text-slate-400 mt-2">Sales tracking starts in Phase 3</p>
          </div>
        </SectionCard>

        {/* Low stock bar */}
        <div className="lg:col-span-2">
          <SectionCard title="Low Stock Alert">
            {lowStockItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                <Package size={32} className="mb-2 opacity-30" />
                <p className="text-sm">
                  {statsData?.total === 0 ? 'No products yet' : 'All stock levels are healthy'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
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
                      <span
                        className={`text-xs font-bold tabular-nums ${
                          isOut ? 'text-red-600' : 'text-amber-600'
                        }`}
                      >
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

      {/* Stock by category */}
      {statsData && statsData.total > 0 && (
        <SectionCard title="Inventory Overview">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={SALES_PLACEHOLDER} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: CHART_SLATE }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: CHART_SLATE }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Bar dataKey="sales" radius={[4, 4, 0, 0]}>
                {SALES_PLACEHOLDER.map((_, i) => (
                  <Cell key={i} fill={i % 2 === 0 ? CHART_ORANGE : '#fb923c'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-center text-xs text-slate-400 mt-2">Category breakdown coming after products are added</p>
        </SectionCard>
      )}
    </div>
  );
}
