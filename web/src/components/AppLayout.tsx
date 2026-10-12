import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { OfflineBanner } from './OfflineBanner';
import { JkLogo } from './JkLogo';
import { SubscriptionBanner } from '@/features/billing/SubscriptionGuard';
import { useSubscription } from '@/hooks/useSubscription';
import { creditsApi } from '@/lib/creditsApi';
import { productsApi } from '@/lib/inventoryApi';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  MoreHorizontal,
  BarChart3,
  ShoppingBag,
  Users,
  Settings,
  LogOut,
  Bot,
  ChevronRight,
  Receipt,
  Truck,
  Bell,
  AlertCircle,
  Clock,
  CreditCard,
  ClipboardList,
  AlertTriangle,
} from 'lucide-react';
import { clsx } from 'clsx';

const BOTTOM_TABS = [
  { to: '/sell',      label: 'nav.sell',      icon: ShoppingCart },
  { to: '/products',  label: 'nav.products',  icon: Package },
  { to: '/dashboard', label: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/more',      label: 'nav.more',      icon: MoreHorizontal },
];

const NAV_GROUPS = [
  {
    items: [
      { to: '/dashboard', label: 'nav.dashboard', icon: LayoutDashboard },
      { to: '/sell',      label: 'nav.sell',      icon: ShoppingCart },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { to: '/products',  label: 'nav.products',  icon: Package },
      { to: '/suppliers', label: 'nav.suppliers', icon: Truck },
      { to: '/purchases', label: 'nav.purchases', icon: ShoppingBag },
      { to: '/alerts',    label: 'nav.alerts',    icon: AlertTriangle },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/sales-history', label: 'nav.salesHistory', icon: ClipboardList },
      { to: '/credits',       label: 'nav.credits',      icon: CreditCard },
      { to: '/customers',     label: 'nav.customers',    icon: Users },
      { to: '/expenses',      label: 'nav.expenses',     icon: Receipt },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/reports',  label: 'nav.reports',  icon: BarChart3 },
      { to: '/settings', label: 'nav.settings', icon: Settings },
    ],
  },
];

function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: creditData } = useQuery({
    queryKey: ['credits', 'reminders'],
    queryFn: creditsApi.reminders,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  const { data: stockData } = useQuery({
    queryKey: ['products', 'lowStock', 'bell'],
    queryFn: () => productsApi.list({ lowStock: true, limit: 4 }),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });

  const creditUrgent = (creditData?.overdueCount ?? 0) + (creditData?.todayCount ?? 0);
  const stockTotal = stockData?.total ?? 0;
  const totalCount = creditUrgent + stockTotal;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isEmpty = stockTotal === 0 && (creditData?.items.length ?? 0) === 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Bell size={18} />
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 text-[9px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</p>
            {totalCount > 0 && (
              <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                {totalCount} alerts
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {/* Low Stock Section */}
            {stockTotal > 0 && (
              <>
                <div className="px-4 py-1.5 bg-orange-50 dark:bg-orange-900/10 flex items-center justify-between border-b border-orange-100 dark:border-orange-900/20">
                  <div className="flex items-center gap-1.5">
                    <Package size={11} className="text-orange-500" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">Low Stock</p>
                  </div>
                  <span className="text-[10px] font-bold text-orange-600">{stockTotal} items</span>
                </div>
                {(stockData?.products ?? []).map((product) => (
                  <button
                    key={product._id}
                    onClick={() => { navigate('/alerts'); setOpen(false); }}
                    className="w-full text-left px-4 py-2.5 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <AlertTriangle size={12} className="text-orange-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{product.name}</p>
                          <p className="text-[10px] text-slate-400">{product.sku}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={clsx('text-xs font-bold', product.stockQty <= 0 ? 'text-red-600' : 'text-orange-600')}>
                          {product.stockQty} left
                        </p>
                        <p className="text-[10px] text-slate-400">min {product.reorderLevel}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Payment Reminders Section */}
            {(creditData?.items.length ?? 0) > 0 && (
              <>
                <div className="px-4 py-1.5 bg-red-50 dark:bg-red-900/10 flex items-center justify-between border-b border-red-100 dark:border-red-900/20">
                  <div className="flex items-center gap-1.5">
                    <CreditCard size={11} className="text-red-500" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">Payments</p>
                  </div>
                  {creditUrgent > 0 && (
                    <span className="text-[10px] font-bold text-red-600">{creditUrgent} urgent</span>
                  )}
                </div>
                {creditData!.items.slice(0, 3).map((item, i) => (
                  <button
                    key={i}
                    onClick={() => { navigate('/credits'); setOpen(false); }}
                    className="w-full text-left px-4 py-2.5 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      {item.type === 'overdue' ? (
                        <AlertCircle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <Clock size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                          {item.customerName}
                          {item.customerPhone && <span className="text-slate-400 font-normal"> · {item.customerPhone}</span>}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {item.saleNumber} · RWF {item.amount.toLocaleString()}
                        </p>
                      </div>
                      <p className={clsx('text-[10px] font-bold flex-shrink-0 mt-0.5', item.type === 'overdue' ? 'text-red-500' : 'text-amber-500')}>
                        {item.type === 'overdue' ? 'OVERDUE' : item.type === 'today' ? 'TODAY' : 'SOON'}
                      </p>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Empty state */}
            {isEmpty && (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                <Bell size={24} className="opacity-30" />
                <p className="text-xs">All clear — no alerts</p>
              </div>
            )}
          </div>

          <button
            onClick={() => { navigate('/alerts'); setOpen(false); }}
            className="w-full px-4 py-2.5 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors border-t border-slate-100 dark:border-slate-700"
          >
            View all alerts →
          </button>
        </div>
      )}
    </div>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const { data } = useAuth();
  const logout = useLogout();
  const navigate = useNavigate();
  const { data: sub } = useSubscription();

  const userInitial = data?.user.name?.[0]?.toUpperCase() ?? '?';
  const membership = data?.memberships?.[0];
  const shopName = membership?.shopId?.name ?? 'Shop';

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar — dark, Shopify-style */}
      <aside className="hidden md:flex w-56 flex-col bg-slate-900 text-slate-300 flex-shrink-0">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 px-4 border-b border-slate-800">
          <JkLogo size={28} color="#ffffff" />
          <span className="font-bold text-white tracking-tight text-base">JUAKALI</span>
        </div>

        {/* Shop pill */}
        {data?.user && (
          <div className="px-3 py-2 border-b border-slate-800">
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-slate-800/60">
              <div className="h-5 w-5 rounded bg-primary-600/20 flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary-400">P</span>
              </div>
              <span className="text-xs font-medium text-slate-300 truncate">{shopName}</span>
              <ChevronRight size={12} className="ml-auto text-slate-600" />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                  {group.label}
                </p>
              )}
              {group.items.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors mb-0.5',
                      isActive
                        ? 'bg-primary-600/15 text-primary-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <link.icon
                        size={16}
                        className={isActive ? 'text-primary-400' : 'text-slate-500'}
                      />
                      {t(link.label)}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-slate-800 p-2 space-y-0.5">
          <button
            onClick={() => navigate('/ai')}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <Bot size={16} className="text-slate-500" />
            {t('nav.aiAssistant')}
          </button>

          <div className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors cursor-default">
            <div className="h-7 w-7 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">{userInitial}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{data?.user.name}</p>
              <p className="text-[10px] text-slate-500 truncate capitalize">{membership?.role ?? ''}</p>
            </div>
            <button
              onClick={() => logout.mutate()}
              className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors"
              title={t('auth.logout')}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar with notification bell */}
        <div className="flex items-center justify-end px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <NotificationBell />
        </div>
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom tabs */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 flex pb-safe-bottom">
          {BOTTOM_TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                clsx(
                  'flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-slate-400 dark:text-slate-500',
                )
              }
            >
              <tab.icon size={20} />
              <span className="text-[10px]">{t(tab.label)}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <OfflineBanner />
      {sub && <SubscriptionBanner data={sub} />}
    </div>
  );
}
