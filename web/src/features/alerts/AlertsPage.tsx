import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { productsApi } from '@/lib/inventoryApi';
import { creditsApi } from '@/lib/creditsApi';
import { waPhone } from '@/lib/exportUtils';
import { AlertTriangle, Package, CreditCard, ShoppingBag, MessageCircle } from 'lucide-react';
import { clsx } from 'clsx';

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'red' | 'orange' | 'amber' | 'default';
}) {
  return (
    <div
      className={clsx(
        'bg-white dark:bg-slate-800 rounded-xl border p-4 flex items-center gap-3',
        color === 'red'
          ? 'border-red-100 dark:border-red-900/30'
          : color === 'orange'
          ? 'border-orange-100 dark:border-orange-900/30'
          : color === 'amber'
          ? 'border-amber-100 dark:border-amber-900/30'
          : 'border-slate-200 dark:border-slate-700',
      )}
    >
      <div
        className={clsx(
          'h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0',
          color === 'red'
            ? 'bg-red-50 dark:bg-red-900/20'
            : color === 'orange'
            ? 'bg-orange-50 dark:bg-orange-900/20'
            : color === 'amber'
            ? 'bg-amber-50 dark:bg-amber-900/20'
            : 'bg-slate-50 dark:bg-slate-700',
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export function AlertsPage() {
  const navigate = useNavigate();

  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ['products', 'lowStock', 'alerts'],
    queryFn: () => productsApi.list({ lowStock: true, limit: 50 }),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });

  const { data: creditData, isLoading: creditLoading } = useQuery({
    queryKey: ['credits', 'reminders'],
    queryFn: creditsApi.reminders,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  const lowStockItems = stockData?.products ?? [];
  const outOfStockCount = lowStockItems.filter((p) => p.stockQty <= 0).length;
  const creditItems = creditData?.items ?? [];
  const overdueCount = creditData?.overdueCount ?? 0;
  const todayCount = creditData?.todayCount ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Alerts</h1>
        <p className="text-sm text-slate-500 mt-0.5">Items requiring your attention</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Package size={18} className="text-orange-500" />}
          label="Low Stock"
          value={stockData?.total ?? 0}
          color="orange"
        />
        <StatCard
          icon={<AlertTriangle size={18} className="text-red-500" />}
          label="Out of Stock"
          value={outOfStockCount}
          color="red"
        />
        <StatCard
          icon={<CreditCard size={18} className="text-red-500" />}
          label="Overdue Payments"
          value={overdueCount}
          color="red"
        />
        <StatCard
          icon={<CreditCard size={18} className="text-amber-500" />}
          label="Due Today"
          value={todayCount}
          color="amber"
        />
      </div>

      {/* Low Stock */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Package size={15} className="text-orange-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Low Stock</h2>
          {(stockData?.total ?? 0) > 0 && (
            <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
              {stockData!.total}
            </span>
          )}
        </div>

        {stockLoading ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-sm text-slate-400">
            Loading…
          </div>
        ) : lowStockItems.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
            <Package size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-500">All products are well-stocked</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Product
                    </th>
                    <th className="text-center px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      In Stock
                    </th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Status
                    </th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((product) => {
                    const outOfStock = product.stockQty <= 0;
                    const critical = product.stockQty > 0 && product.stockQty === 1;
                    return (
                      <tr
                        key={product._id}
                        className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900 dark:text-white">{product.name}</p>
                          <p className="text-[11px] text-slate-400">{product.sku}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={clsx(
                              'font-bold',
                              outOfStock ? 'text-red-600' : 'text-slate-900 dark:text-white',
                            )}
                          >
                            {product.stockQty}
                          </span>
                          <span className="text-xs text-slate-400 ml-1">{product.unit}</span>
                        </td>
                        <td className="px-4 py-3">
                          {outOfStock ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                              OUT OF STOCK
                            </span>
                          ) : critical ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">
                              CRITICAL
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                              LOW
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => navigate('/purchases')}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <ShoppingBag size={12} />
                            Create PO
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Payment Reminders */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <CreditCard size={15} className="text-red-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Payment Reminders</h2>
          {overdueCount + todayCount > 0 && (
            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
              {overdueCount + todayCount} urgent
            </span>
          )}
        </div>

        {creditLoading ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-sm text-slate-400">
            Loading…
          </div>
        ) : creditItems.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
            <CreditCard size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-500">No upcoming credit payments</p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Customer
                      </th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hidden md:table-cell">
                        Sale #
                      </th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Amount
                      </th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Due Date
                      </th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Status
                      </th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {creditItems.map((item, i) => (
                      <tr
                        key={i}
                        className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900 dark:text-white">{item.customerName}</p>
                          {item.customerPhone && (
                            <p className="text-[11px] text-slate-400">{item.customerPhone}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs">
                          {item.saleNumber}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {item.amount.toLocaleString()}{' '}
                          <span className="text-xs font-normal text-slate-400">RWF</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                          {new Date(item.dueDate).toLocaleDateString('en-RW', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          {item.type === 'overdue' ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                              OVERDUE
                            </span>
                          ) : item.type === 'today' ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                              DUE TODAY
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              SOON
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.customerPhone ? (
                            <a
                              href={`https://wa.me/${waPhone(item.customerPhone)}?text=${encodeURIComponent(
                                `Hi ${item.customerName}, this is a reminder for your credit payment.\nSale: ${item.saleNumber}\nAmount due: ${item.amount.toLocaleString()} RWF\nDue: ${new Date(item.dueDate).toLocaleDateString('en-RW', { day: 'numeric', month: 'short', year: 'numeric' })}\n\nPlease contact us to settle your balance.`,
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <MessageCircle size={12} />
                              WhatsApp
                            </a>
                          ) : (
                            <button
                              onClick={() => navigate('/credits')}
                              className="text-xs text-primary-600 hover:underline"
                            >
                              View
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <button
              onClick={() => navigate('/credits')}
              className="mt-2 text-xs font-medium text-primary-600 hover:underline"
            >
              Manage all credit accounts →
            </button>
          </>
        )}
      </section>
    </div>
  );
}
