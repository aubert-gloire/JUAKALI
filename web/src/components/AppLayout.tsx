import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { OfflineBanner } from './OfflineBanner';
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
  Zap,
  ChevronRight,
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
      { to: '/purchases', label: 'nav.purchases', icon: ShoppingBag },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: '/customers', label: 'nav.customers', icon: Users },
      { to: '/reports',   label: 'nav.reports',   icon: BarChart3 },
      { to: '/settings',  label: 'nav.settings',  icon: Settings },
    ],
  },
];

export function AppLayout() {
  const { t } = useTranslation();
  const { data } = useAuth();
  const logout = useLogout();
  const navigate = useNavigate();

  const userInitial = data?.user.name?.[0]?.toUpperCase() ?? '?';
  const membership = data?.memberships?.[0];
  const shopName = membership?.shopId?.name ?? 'Shop';

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar — dark, Shopify-style */}
      <aside className="hidden md:flex w-56 flex-col bg-slate-900 text-slate-300 flex-shrink-0">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 px-4 border-b border-slate-800">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-600">
            <Zap size={14} className="text-white" strokeWidth={2.5} />
          </div>
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
    </div>
  );
}
